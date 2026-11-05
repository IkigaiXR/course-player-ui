// Minimal ambient augmentation for Next.js's `<style jsx global>` syntax,
// used by every element in this package (pre-existing pattern, not
// introduced here). The `styled-jsx` package's own shipped types rely on
// being referenced via Next.js's generated next-env.d.ts, which doesn't
// exist in this standalone package -- this file exists so `tsc` can check
// this package in isolation at all (it apparently never had been run
// standalone before this PR). Next.js's own build of the consuming app
// still does the real compile-time transform; this is a type-check-only
// concern.
import 'react';

declare module 'react' {
  interface StyleHTMLAttributes<T> extends React.HTMLAttributes<T> {
    jsx?: boolean;
    global?: boolean;
  }
}
