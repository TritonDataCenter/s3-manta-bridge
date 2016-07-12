# Contributing

We love pull requests from everyone.

Fork, then clone the repo:

    git clone git@github.com:your-username/joyent/java-manta.git

For running integration tests, you will need an account on a Manta system this could
be the [Joyent Public Cloud](https://www.joyent.com/public-cloud) or an 
on-premise Manta installation. 

Set up your machine:

You will need to set the following environment variables (or their aliases):
    MANTA_URL, MANTA_USER, MANTA_KEY_ID, MANTA_KEY_PATH

It may be useful to install the [node.js manta CLI utility](https://www.npmjs.com/package/manta) 
to verify that you can connect to Manta before running the tests:

    npm install -g manta
    
Make sure all tests including the integration tests pass:

    npm test

Make your change. Add tests for your change. Make sure that all tests and style 
checks pass.

Add your changes to the CHANGELOG.md and commit.

Push to your fork and [submit a pull request][pr].

[pr]: https://github.com/dekobon/s3-manta-bridge/compare/

At this point you're waiting on us. We like to at least comment on pull requests
within three business days (and, typically, one business day). We may suggest
some changes or improvements or alternatives.

Some things that will increase the chance that your pull request is accepted:

* Filing a github issue describing the improvement or the bug before you start work.
* Write tests.
* Follow the style rules defined in `.eslintrc` and `.jshintc`.
* Write a good commit message.
