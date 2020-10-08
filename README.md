ecr-cleaner
===========

Lambda used for ECR cleanup

### Local usage

`yarn start` runs the lambda in dev mode. This works on your actual ECR repositories if you're logged in to AWS.

### Release
`yarn version (--patch|--minor|--major|--new version 1.2.3|...)`
`git push --tags`
This will release a zip file on GitHub.
