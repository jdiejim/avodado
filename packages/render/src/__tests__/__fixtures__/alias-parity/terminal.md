```terminal
title: deploy — production
session: |
  $ kubectl rollout status deploy/api
  # wait for the rollout to settle before tagging
  deployment "api" successfully rolled out
  $ git tag v1.4.1 && git push --tags
```
