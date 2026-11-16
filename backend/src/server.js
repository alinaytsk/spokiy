// Local development entry point: the only place that opens a port.
//
// Lambda never runs this file - it loads lambda.js, which wraps the same app.

import { app } from './index.js';
import { authBypassed } from './middleware/auth.js';

const port = Number(process.env.PORT) || 4000;

app.listen(port, () => {
  console.log(`sPOKiy API listening on http://localhost:${port}`);
  if (authBypassed) {
    console.log('AUTH_BYPASS is on: every request is treated as local-dev-user.');
  }
});
