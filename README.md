# vscode-graphiql-explorer

Use GraphiQL + GraphiQL Explorer to build your GraphQL operations, right from inside of VSCode.

![Demo](https://github.com/zth/vscode-graphiql-explorer/blob/master/images/vscode-graphiql-explorer.gif?raw=true)

## Features

- Explore your schema and edit + insert GraphQL operations using GraphiQL Explorer conveniently right from VSCode.
- Supports:
  - `graphql` and `gql` tags in JavaScript/TypeScript/Vue
  - `[%graphql]` and `[%relay]` nodes in ReasonML
  - Plain `.graphql` files
  - ...easy to add support for more languages and frameworks
- Explore your schema using GraphiQL right from VSCode.

## Setup

`vscode-graphiql-explorer` needs your introspected schema, either in a `.json` or a `.graphql` file. It tries to find your schema by looking in the workspace root for:

1. A `.graphqlconfig` file containing `schemaPath` pointing to your schema, like `{ "schemaPath": "/path/to/schema.graphql" }`.
2. `schema.graphql`, `schema.json` or `graphql_schema.json`.

If your schema is located somewhere other than the workspace root, please add and configure a `.graphqlconfig` file pointing to the schema as described above.

If you don't have a schema file, you can create one by running `npx get-graphql-schema http://url/to/your/graphql/endpoint > schema.graphql` in your project root.

## Usage

The extension adds 3 commands:

1. `Edit operation`, which let you edit an operation in GraphiQL. Use this with the cursor set in a tag (or full `.graphql` file) containing a GraphQL operation.
2. `Insert operation here`, which let you insert an operation into your source file via GraphiQL. Use this with the cursor set in an empty GraphQL tag, or in a `.graphql` file.
3. `Explore schema with GraphiQL`, which opens GraphiQL and let you explore your schema, without inserting or editing anything.

## Contributing

_Coming soon_.
