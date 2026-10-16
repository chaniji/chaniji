depends on: [[A console.log is root]]

## Why we need this

Template literal (node C) works, but writing `${x}` for every variable gets long when you have many values to print together. There is a shorter way.

## The idea

`console.log()` can take more than one argument, separated by commas. It prints all of them on one line, space-separated.

```ts
let name: string = "Sam";
let age: number = 20;
console.log(name, age); // prints: Sam 20
console.log("Name:", name, "Age:", age); // prints: Name: Sam Age: 20
```

## How it connects

Same `console.log()` from node A. No new syntax needed inside the string — just hand it several separate values, comma by comma.
