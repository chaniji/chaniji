depends on: [[B String literal]]

## Why we need this

Sometimes you want to print a variable's value mixed with fixed text. Plain string literal can't insert a variable.

## The idea

A template literal uses backticks `` ` ` `` instead of quotes, and `${...}` to insert a value.

```ts
let x: number = 5;
console.log(`Value is ${x}`); // prints: Value is 5
```

## How it connects

Template literal is still a string literal (node B), just a special kind that can insert variables.

## Check

Confirmed via Phase 1 probe (Q2): learner correctly said this prints `Value is 5`. ✓
