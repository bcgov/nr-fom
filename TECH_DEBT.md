# Technical Debt Assessment: TypeScript 6.0 Strict Upgrade

This document outlines the technical debt and compilation errors uncovered during the TypeScript 6.0 upgrade for the `bcgov/nr-fom` workspace.

## Executive Summary
Prior to the TypeScript 6.0 upgrade, the codebase operated under loose type-checking configurations. This allowed invalid type assignments, unhandled null/undefined values, and implicit `any` variables to bypass compilation. Under TypeScript 6.0's strict type safety standards, these issues have been flagged as compiler errors. 

A total of **477 compilation errors** were identified across the workspace when strict type-checking flags were restored:

| Error Code | Category | Occurrences | Description | Impact & Risks |
|---|---|---|---|---|
| **TS2564** | Property Initialization | 266 | Class properties (mainly NestJS DTOs and TypeORM Entities) have no initializer or definite assignment assertion (`!`). | High volume, but low runtime risk. Solved using definite assignment assertions (`!`) for decorated properties. |
| **TS7005 / TS7006** | Implicit `any` Types | 48 | Function parameters and variables default to `any` because no type definition was provided. | Medium risk. Bypasses compile-time type checks, leaving the application prone to runtime shape mismatches. |
| **TS18047 / TS18048** | Null & Undefined Unsafety | 34 | Properties accessed on objects that may be `null` or `undefined` without safe navigation (`?.`) or runtime checks. | High risk. Directly leads to `TypeError: Cannot read properties of null/undefined` crashes. |
| **TS2322 / TS2345** | Type Mismatches | 81 | Assigning values or passing parameters of incompatible types. | High risk. Results in unexpected behavior at runtime if object shapes diverge. |
| **TS2454** | Used Before Assignment | 13 | Variables declared but used conditionally before being guaranteed an assignment. | High risk. ReferenceErrors or undefined-access bugs. |
| **Others** | Miscellaneous type issues | 35 | Casts, obsolete configurations, and missing library typings. | Low to Medium risk. |

---

## Coding Standards & Rules Going Forward

To prevent regressions and maintain a stable, production-ready application, the following standards are now enforced:

1. **Strict Type Safety Enforced**
   All workspaces (`api`, `libs`, `admin`, `public`) must compile with `"strict": true` and `"noImplicitAny": true`. We do not bypass these rules to hide errors.

2. **Definite Assignment Assertions for NestJS/TypeORM**
   Since TypeORM Entity properties and NestJS DTO properties are initialized at runtime via framework decorators rather than constructors, they must use the definite assignment assertion operator (`!`):
   ````typescript
   // Correct
   @Column()
   revisionCount!: number;

   // Incorrect
   @Column()
   revisionCount: number;
   ````

3. **Explicit Typing**
   Implicit `any` is prohibited. If a value is dynamic, type it explicitly as `any` or `unknown` with documenting comments:
   ````typescript
   // Correct
   function handlePayload(data: unknown) { ... }

   // Incorrect
   function handlePayload(data) { ... }
   ````

4. **Optional Chaining and Null Checks**
   Never assume an external payload or optional database relation is populated. Always use optional chaining (`?.`) or explicit guards:
   ````typescript
   // Correct
   const kid = decodedToken?.header?.kid;

   // Incorrect
   const kid = decodedToken.header.kid;
   ````
