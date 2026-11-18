// The whole of sPOKiy's AWS footprint, in one stack.
//
//   Cognito user pool + app client     sign-up, e-mail confirmation, sign-in
//   (optional) Google sign-in          only when SPOKIY_GOOGLE_CLIENT_ID is set at deploy
//   DynamoDB x3 (on demand)            progress, requests, feedback
//   Lambda + HTTP API                  the Express app from backend/, unchanged
//   S3 + CloudFront                    frontend/dist over HTTPS, plus a generated config.json
//
// The contract with the other two folders is written down in infra/README.md; this file
// is the implementation of it. Three decisions worth knowing before changing anything:
//
// 1. The Lambda is NOT bundled with esbuild. backend/src/routes/topics.js reads the quiz
//    bank and cheat sheets from disk relative to its own file, and a bundle would move the
//    code away from the data. So the backend folder ships as it is, with production-only
//    node_modules installed by `npm run build:app` before deploy.
//
// 2. The frontend's config.json is generated here, from the real pool and API, and
//    replaces the localhost placeholder in the built site. That is the "step that is easy
//    to miss" from the README - it is not a step any more, the deploy does it.
//
// 3. The user pool and tables are RETAINED when the stack is destroyed: they hold the
//    accounts, votes and feedback from the live test, which the report depends on. The
//    bucket only holds build output and is deleted with the stack.

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Annotations, CfnOutput, Duration, RemovalPolicy, SecretValue, Stack } from 'aws-cdk-lib';
import { HttpApi } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import {
  AllowedMethods,
  CachePolicy,
  Distribution,
  PriceClass,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import {
  AccountRecovery,
  OAuthScope,
  ProviderAttribute,
  UserPool,
  UserPoolClient,
  UserPoolClientIdentityProvider,
  UserPoolIdentityProviderGoogle,
  VerificationEmailStyle,
} from 'aws-cdk-lib/aws-cognito';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Architecture, Code, Function as LambdaFunction, Runtime } from 'aws-cdk-lib/aws-lambda';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { BlockPublicAccess, Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');
const backendDir = join(repoRoot, 'backend');
const frontendDist = join(repoRoot, 'frontend', 'dist');

// The local dev server, allowed as a CORS origin so teammates can point `npm run dev` at
// the deployed API. CORS is not what protects the private routes - the Cognito token is.
const LOCAL_DEV_ORIGIN = 'http://localhost:5173';

// Google sign-in is opt-in. With SPOKIY_GOOGLE_CLIENT_ID unset, none of the Google pieces
// below are created and the stack is exactly the e-mail-only one - nothing changes for a
// deploy that does not ask for it.
//
// The client secret is never in the repo or the template: it is read from Secrets Manager
// at deploy time (a CloudFormation dynamic reference). Create it once:
//   aws secretsmanager create-secret --name spokiy/google-client-secret --secret-string '<secret>'
const GOOGLE_CLIENT_ID = process.env.SPOKIY_GOOGLE_CLIENT_ID;
const GOOGLE_SECRET_NAME = 'spokiy/google-client-secret';

// The Cognito hosted domain is <prefix>.auth.<region>.amazoncognito.com. The prefix must be
// unique in the region, so it can be overridden if this one is taken.
const AUTH_DOMAIN_PREFIX = process.env.SPOKIY_AUTH_DOMAIN_PREFIX || 'spokiy-ucu';

export class SpokiyStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    // --- Cognito ---------------------------------------------------------------------
    //
    // The frontend signs up with { username: email }, so e-mail IS the username. The
    // password rules match what the sign-up form tells people (8+ characters, nothing
    // else): a stricter pool than the form admits to produces errors nobody can act on,
    // which is exactly what the live test would end up recording.

    const userPool = new UserPool(this, 'UserPool', {
      userPoolName: 'spokiy-users',
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: { email: { required: true, mutable: true } },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: false,
        requireUppercase: false,
        requireDigits: false,
        requireSymbols: false,
      },
      userVerification: {
        emailStyle: VerificationEmailStyle.CODE,
        emailSubject: 'Your sPOKiy confirmation code',
        emailBody: 'Your sPOKiy confirmation code is {####}',
      },
      accountRecovery: AccountRecovery.EMAIL_ONLY,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    // --- DynamoDB --------------------------------------------------------------------
    //
    // Key schemas are the ones the routes in backend/src/routes/ expect. Names are left
    // to CloudFormation and passed to the Lambda through the environment.

    const tableProps = {
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.RETAIN,
    };

    const progressTable = new Table(this, 'ProgressTable', {
      ...tableProps,
      partitionKey: { name: 'userId', type: AttributeType.STRING },
      sortKey: { name: 'topicId', type: AttributeType.STRING },
    });

    const requestsTable = new Table(this, 'RequestsTable', {
      ...tableProps,
      partitionKey: { name: 'topic', type: AttributeType.STRING },
      sortKey: { name: 'userId', type: AttributeType.STRING },
    });

    const feedbackTable = new Table(this, 'FeedbackTable', {
      ...tableProps,
      partitionKey: { name: 'userId', type: AttributeType.STRING },
      sortKey: { name: 'createdAt', type: AttributeType.STRING },
    });

    // --- the static site -------------------------------------------------------------
    //
    // Created before the Lambda because the Lambda's CORS_ORIGINS needs the CloudFront
    // domain. Nothing here refers back to the API, so there is no cycle.

    const siteBucket = new Bucket(this, 'SiteBucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const siteOrigin = S3BucketOrigin.withOriginAccessControl(siteBucket);

    const distribution = new Distribution(this, 'SiteDistribution', {
      comment: 'sPOKiy frontend',
      defaultRootObject: 'index.html',
      priceClass: PriceClass.PRICE_CLASS_100,
      defaultBehavior: {
        origin: siteOrigin,
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: AllowedMethods.ALLOW_GET_HEAD,
        cachePolicy: CachePolicy.CACHING_OPTIMIZED,
        compress: true,
      },
      additionalBehaviors: {
        // Fetched once at startup and must reflect the current deploy, never a cached one.
        '/config.json': {
          origin: siteOrigin,
          viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: CachePolicy.CACHING_DISABLED,
        },
      },
      // React Router owns the paths. A deep link like /topics/pipelining has no object in
      // the bucket, which S3 answers with 403 (OAC hides 404s); either way, serve the app
      // and let the router decide.
      errorResponses: [403, 404].map((httpStatus) => ({
        httpStatus,
        responseHttpStatus: 200,
        responsePagePath: '/index.html',
        ttl: Duration.seconds(0),
      })),
    });

    const siteUrl = `https://${distribution.distributionDomainName}`;

    // --- Google sign-in (optional) ----------------------------------------------------
    //
    // Google sends the user back to Cognito's hosted domain, Cognito to the site. So the
    // Google OAuth client must list https://<auth domain>/oauth2/idpresponse as its
    // redirect URI (printed as the GoogleRedirectUri output), and the app client below
    // must list the site's own URL as a callback.
    //
    // Google users land in the same pool as e-mail users, with e-mail mapped from the
    // Google profile, so the API sees the same kind of ID token either way.

    let google = null;

    if (GOOGLE_CLIENT_ID) {
      userPool.addDomain('AuthDomain', {
        cognitoDomain: { domainPrefix: AUTH_DOMAIN_PREFIX },
      });

      const provider = new UserPoolIdentityProviderGoogle(this, 'Google', {
        userPool,
        clientId: GOOGLE_CLIENT_ID,
        clientSecretValue: SecretValue.secretsManager(GOOGLE_SECRET_NAME),
        scopes: ['openid', 'email', 'profile'],
        attributeMapping: {
          email: ProviderAttribute.GOOGLE_EMAIL,
          emailVerified: ProviderAttribute.GOOGLE_EMAIL_VERIFIED,
          givenName: ProviderAttribute.GOOGLE_GIVEN_NAME,
          familyName: ProviderAttribute.GOOGLE_FAMILY_NAME,
        },
      });

      google = {
        provider,
        // What Amplify wants: the host only, no scheme.
        domainHost: `${AUTH_DOMAIN_PREFIX}.auth.${this.region}.amazoncognito.com`,
      };
    }

    // The trailing slash matters: Cognito compares callback URLs exactly, and the frontend
    // sends `${origin}/`.
    const callbackUrls = [`${siteUrl}/`, `${LOCAL_DEV_ORIGIN}/`];

    // A browser cannot keep a secret, so no client secret. SRP is what aws-amplify/auth
    // uses by default for signIn(). Created after the distribution only because the Google
    // callback URLs need the site's domain; its logical id is unchanged.
    const userPoolClient = new UserPoolClient(this, 'WebClient', {
      userPool,
      userPoolClientName: 'spokiy-web',
      generateSecret: false,
      authFlows: { userSrp: true },
      preventUserExistenceErrors: true,
      ...(google && {
        supportedIdentityProviders: [
          UserPoolClientIdentityProvider.COGNITO,
          UserPoolClientIdentityProvider.GOOGLE,
        ],
        oAuth: {
          flows: { authorizationCodeGrant: true },
          scopes: [OAuthScope.OPENID, OAuthScope.EMAIL, OAuthScope.PROFILE],
          callbackUrls,
          logoutUrls: callbackUrls,
        },
      }),
    });

    // The client can only name GOOGLE once the provider exists.
    if (google) userPoolClient.node.addDependency(google.provider);

    // --- the API ---------------------------------------------------------------------

    if (!existsSync(join(backendDir, 'node_modules', 'express'))) {
      Annotations.of(this).addWarning(
        'backend/node_modules is missing: the Lambda would fail at startup. ' +
          'Run `npm run build:app` in infra/ (or just `npm run deploy`, which does it).',
      );
    }

    const apiLogs = new LogGroup(this, 'ApiLogs', {
      retention: RetentionDays.TWO_WEEKS,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const apiFunction = new LambdaFunction(this, 'ApiFunction', {
      runtime: Runtime.NODEJS_22_X,
      architecture: Architecture.ARM_64,
      handler: 'lambda.handler',
      code: Code.fromAsset(backendDir, {
        // .env is a developer's local file and may hold AUTH_BYPASS=true; it must never
        // reach Lambda (NODE_ENV=production would neutralise it, but still).
        exclude: ['.env', '.env.*', 'test', '*.log', '.gitignore'],
      }),
      memorySize: 512,
      timeout: Duration.seconds(10),
      logGroup: apiLogs,
      environment: {
        NODE_ENV: 'production',
        COGNITO_USER_POOL_ID: userPool.userPoolId,
        COGNITO_CLIENT_ID: userPoolClient.userPoolClientId,
        TABLE_PROGRESS: progressTable.tableName,
        TABLE_REQUESTS: requestsTable.tableName,
        TABLE_FEEDBACK: feedbackTable.tableName,
        CORS_ORIGINS: `${siteUrl},${LOCAL_DEV_ORIGIN}`,
      },
    });

    // Read/write on the three tables and nothing else.
    for (const table of [progressTable, requestsTable, feedbackTable]) {
      table.grantReadWriteData(apiFunction);
    }

    // HTTP API with a single catch-all route: Express does the routing, and OPTIONS
    // preflights reach Express too, so the `cors` middleware stays the one place CORS is
    // decided. (Configuring corsPreflight here as well would answer OPTIONS twice over.)
    const httpApi = new HttpApi(this, 'HttpApi', {
      apiName: 'spokiy-api',
      defaultIntegration: new HttpLambdaIntegration('ApiIntegration', apiFunction),
    });

    // apiEndpoint has no trailing slash; the frontend appends paths that start with '/'.
    const apiUrl = httpApi.apiEndpoint;

    // --- publish the site ------------------------------------------------------------

    const siteSources = [];

    if (existsSync(join(frontendDist, 'index.html'))) {
      // The committed config.json points at localhost; it is replaced below.
      siteSources.push(Source.asset(frontendDist, { exclude: ['config.json'] }));
    } else {
      Annotations.of(this).addWarning(
        'frontend/dist is missing: the site will be a one-line placeholder. ' +
          'Run `npm run build:app` in infra/ (or just `npm run deploy`, which does it).',
      );
      siteSources.push(
        Source.data('index.html', '<p>sPOKiy: the frontend was not built before deploy.</p>'),
      );
    }

    siteSources.push(
      Source.jsonData('config.json', {
        apiUrl,
        region: this.region,
        userPoolId: userPool.userPoolId,
        userPoolClientId: userPoolClient.userPoolClientId,
        // Only present when Google sign-in is deployed; the frontend shows the button
        // only if it is there.
        ...(google && { oauthDomain: google.domainHost }),
      }),
    );

    new BucketDeployment(this, 'DeploySite', {
      sources: siteSources,
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: ['/*'],
      memoryLimit: 512,
    });

    // --- outputs ---------------------------------------------------------------------
    //
    // `npm run deploy` writes these to infra/cdk-outputs.json as well. The four the
    // backend .env needs to talk to the real tables are the Table* and UserPool* ones.

    new CfnOutput(this, 'SiteUrl', { value: siteUrl, description: 'The site, over HTTPS' });
    new CfnOutput(this, 'ApiUrl', { value: apiUrl, description: 'The API base URL' });
    new CfnOutput(this, 'Region', { value: this.region });
    new CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId });
    new CfnOutput(this, 'TableProgress', { value: progressTable.tableName });
    new CfnOutput(this, 'TableRequests', { value: requestsTable.tableName });
    new CfnOutput(this, 'TableFeedback', { value: feedbackTable.tableName });
    new CfnOutput(this, 'ApiLogGroup', { value: apiLogs.logGroupName });

    if (google) {
      new CfnOutput(this, 'GoogleRedirectUri', {
        value: `https://${google.domainHost}/oauth2/idpresponse`,
        description: 'Authorised redirect URI for the Google OAuth client',
      });
    }
  }
}
