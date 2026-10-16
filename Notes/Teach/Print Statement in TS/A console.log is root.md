## Why we need this

Code runs silent. No way to see values unless you print them out somewhere.

## The idea

ALL output to the terminal in TypeScript is done through `console.log()`.

```ts
console.log("hi");
```

This is the one door. Everything you print goes through it.

## How it connects

Every other print trick (strings, template literals, multiple values, numbers) is just a different thing you pass INTO `console.log()`. The function itself never changes.

## Check

Confirmed already via Phase 1 probe (Q1): learner correctly picked `console.log("hi")` as the way to print in TypeScript. ✓
