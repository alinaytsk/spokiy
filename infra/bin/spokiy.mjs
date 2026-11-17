#!/usr/bin/env node
// CDK entry point. One stack, one environment.
//
// The region defaults to eu-central-1 (Frankfurt) because that is what the placeholder
// config.json and backend/.env.example already assume. Override with SPOKIY_REGION if the
// account lives elsewhere. The account comes from whichever AWS profile runs `cdk`.

import { App } from 'aws-cdk-lib';

import { SpokiyStack } from '../lib/spokiy-stack.mjs';

const app = new App();

new SpokiyStack(app, 'SpokiyStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.SPOKIY_REGION || 'eu-central-1',
  },
  description: 'sPOKiy: interactive Computer Organization lessons (UCU student project)',
});
