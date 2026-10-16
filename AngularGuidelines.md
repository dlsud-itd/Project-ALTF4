# Angular Coding Guidelines

**Author:** Steven Villarosa

## Guidelines

- Always configure `.gitignore` to ignore the `node_modules` directory.
- Always specify the type for every function parameter.
- Always use the `type` keyword to structure an object instead of `interface`.
- Use `enum` to group together related constants.
- Enum name should be in Pascal case. Enum elements should be capitalized snake case.
- Never use the `any` type or `Object` type.
- Remove dead and unnecessary code and HTML elements.

## This is Angular, not Vanilla JS

- Stop using Vanilla JS ways of doing things.
- Get rid of using `querySelector`, `addEventListener`, and `async/await`.

## Static Files

- Put static files such as images and videos in `public/assets/` or directly inside `public/`.
- Recommended folder structure is shown in the original presentation.

## Type Aliases and Classes

- Use Pascal case for type aliases and classes.

```ts
type Primitive = string | number | boolean | null;
```

Do not use lowercase naming:

```ts
type primitive = string | number | boolean | null;
```

## Decorators, Classes, and TODO Comments

- Decorator functions and class names should be in Pascal case.
- Enclose all components in open and close brackets in the import statement.
- If you need to add something that needs to be done, add a TODO comment using the following formats:

```html
<!-- TODO(Lastname, Givenname): What needs to be done -->
```

```ts
// TODO(Lastname, Givenname): What needs to be done
```

## Styling

- Never use `ngStyle`; put all styles in the CSS file.
- Instead, utilize the `ngClass` directive.
- Group together similar structures separated by a single space (input, output, observables, private properties, etc.).

## `::ng-deep`

When using the `::ng-deep` pseudo-class, always include it in a parent container such as `:host` to make sure that it is encapsulated.

### Incorrect

```css
::ng-deep p {
  background-color: red;
}
```

### Correct

```css
:host {
  ::ng-deep p {
    background-color: red;
  }
}
```

or:

```css
:host ::ng-deep p {
  background-color: red;
}
```

## Built-in Control Flow

- Use the built-in control flow instead of structural directives.

### `@if` instead of `*ngIf`

```html
<!-- Avoid -->
<p *ngIf="isShown">Hello World!</p>

<!-- Use -->
@if (isShown) {
  <p>Hello World!</p>
}
```

### `@for` instead of `*ngFor`

```html
<!-- Avoid -->
<p *ngFor="let obj of objects">
  <span>{{ obj.id }} - </span>
  <span>{{ obj.name }}</span>
</p>

<!-- Use -->
@for (obj of objects; track obj.id) {
  <p>
    <span>{{ obj.id }} - </span>
    <span>{{ obj.name }}</span>
  </p>
}
```

## Type Inference

- Take advantage of TypeScript type inference.
- If declaring a primitive variable that has an initial value, you do not have to specify its type.

```ts
// Unnecessary
isUpdating: boolean = false;

// Preferred
isUpdating = false;
```

- If declaring an object variable from a type or interface, or an array with an initially empty value, you need to specify its type.

```ts
newStudent: Student = {
  studentId: null,
  givenName: '',
  lastName: '',
  finalGrade: null,
};

students: Student[] = [];
```

Without explicit types, these can be equivalent to `any`:

```ts
newStudent = {
  studentId: null,
  givenName: '',
  lastName: '',
  finalGrade: null,
};

students = [];
```

## CSS Nesting

- Consider nesting instead to save space.
- Keep nesting at a maximum of 3 levels.

### Before

```css
:host ::ng-deep .form-container h2 {
  font-size: 24px;
  margin-bottom: 10px;
}

:host ::ng-deep .form-container input[type="text"] {
  width: 100%;
  padding: 10px;
}

:host ::ng-deep .button-container {
  text-align: right;
}
```

### After

```css
:host ::ng-deep {
  .form-container h2 {
    font-size: 24px;
    margin-bottom: 10px;
  }

  .form-container input[type="text"] {
    width: 100%;
    padding: 10px;
  }

  .button-container {
    text-align: right;
  }
}
```

## Reactive Forms

- Always use reactive forms to handle forms.
- For template control flow, observe proper indentation. Prettier might format this incorrectly.
- Try to find a solution online or uninstall Prettier and format your code manually.

Example:

```html
<div>
  <label for="password">Password:</label>
  <input type="password" formControlName="password" />
  @if (passwordControl.invalid && passwordControl.touched) {
    <div>Password is required.</div>
  }
</div>
```

## Multi-line Elements

- When splitting an element into multiple lines of code, add at least double tab indentation to the continuation line to indicate that it is a continuation and not a child element.

Example:

```html
<button mat-raised-button class="edit-button"
    (click)="editMusicItem(musicItem)">
  <span>Edit</span>
</button>
```

## Validators

- Always use the object form when creating validators.

The presentation compares the array form and object form of validators.

## Form Builders

- Use form builders to create forms.

## Validator Return Types

- Specifying return types of validator functions is a good practice to ensure that the function will return only `null` or an object in `{error_code: error_message}` structure.
- This can be a bit confusing and longer, but it will help in the long run.
- Always specify the return types of validator functions.

## HTTP Requests and Models

- Always create a model to structure HTTP responses.
- Do not use the `Object` type. It is equivalent to using the `any` type.
- Create a service to implement HTTP requests.
- Do not use `HttpClient` directly in the component.

### Avoid

```ts
this.http.get<Object>(environment.apiUrl).subscribe((data) => {
  console.log(data);
  return data;
});
```

Instead, HTTP requests should be implemented through a service and structured using an appropriate model.

## Observables and RxJS

- Do not create an observable inside a subscription.
- Use `pipe()` and RxJS operators to chain operations with observables.
- Do not spawn another observable instead of another observable. Use the appropriate RxJS operators.
