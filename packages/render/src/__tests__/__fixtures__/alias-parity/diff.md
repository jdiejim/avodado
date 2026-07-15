```diff
title: "fix: clamp retry backoff"
lang: TypeScript
code: |
  @@ -12,7 +12,7 @@
   function backoff(attempt: number): number {
  -  return 100 * attempt ** 2;
  +  return Math.min(30_000, 100 * attempt ** 2);
   }
```
