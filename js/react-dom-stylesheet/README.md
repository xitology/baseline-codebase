# React DOM Stylesheet

A simple yet powerful way to define styled React DOM components.

## Installation

```
% npm install react-dom-stylesheet
```

## Usage

Basic usage:

```
import {style} from 'react-dom-stylesheet'

let Label = style('span', {
  fontWeight: 'bold',
  fontSize: '12pt',
})
```

Now `Label` is a regular React component styled with `fontWeight` and
`fontSize`. You can render into DOM and use as a part of React element tree:

```
<Label />
```

### Pseudoclasses

Pseudoclasses are supported:

```
let Label = style('span', {
  fontWeight: 'bold',
  fontSize: '12pt',
  hover: {
    textDecoration: 'underline'
  }
})
```

Now on hover you can see the underline appears.

But you can always force any pseudoclass to appear from JS by passing a
specially constructed `variant` prop:

```
<Label variant={{hover: true}} />
```

### Variants

Sometimes you want a set of style variants and toggle them via JS:

```
let Label = style('span', {
  fontWeight: 'bold',
  fontSize: '12pt',
  emphasis: {
    textDecoration: 'underline'
  }
})
```

Now to toggle any particular variant you need to pass a component a specially
constructed `variant` prop:

```
<Label variant={{emphasis: true}} />
```

This is very similar to pseudoclass example above and in fact pseudoclasses are
also variants.

## CSS helpers

There's helpers for producing CSS values:

```
import * as css from 'react-dom-stylesheet/css'

let Label = style('span', {
  fontWeight: css.fontWeight.bold,
  border: css.border(1, css.rgb(167)),
})
```

## Component factories

Component factories for DOM components provided for convenience:

```
import * as css from 'react-dom-stylesheet/css'
import {span} from 'react-dom-stylesheet/component'

let Label = span({
  fontWeight: css.fontWeight.bold,
  border: css.border(1, css.rgb(167)),
})
```
