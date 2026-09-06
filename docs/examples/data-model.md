```meta
title: Commerce data model
subtitle: One erd for a 12-table shop — two schemas, a join table, a self-reference, a view, an enum.
tag: Example
```

The `erd` block accepts a full relational model and draws it: the aggregate root is centred, its neighbours fan out by relation depth, and schema groups become panels. Column flags use the terse grammar (`email citext unique !null`, `user_id uuid fk -> users.id`, `status enum(open,paid)`); a `..` body marks a non-identifying relation.

## The schema

```erd
id: commerce-schema
title: Shop schema
description: The auth schema owns identity; the shop schema owns catalogue, orders and money.
groups:
  - { name: auth, entities: [users, sessions, roles, user_roles] }
  - { name: shop, entities: [categories, products, orders, order_items, payments, addresses, reviews, order_totals] }
enums:
  - { name: order_status, values: [open, paid, shipped, cancelled] }
entities:
  - name: users
    note: People who can sign in.
    columns:
      - id uuid pk default=gen_random_uuid()
      - email citext unique !null
      - display_name text null
      - created_at timestamptz !null default=now()
  - name: sessions
    columns:
      - id uuid pk
      - user_id uuid fk -> users.id !null idx
      - expires_at timestamptz !null
  - name: roles
    columns:
      - id smallint pk
      - name text unique
  - name: user_roles
    columns:
      - user_id uuid pk fk -> users.id
      - role_id smallint pk fk -> roles.id
  - name: categories
    columns:
      - id int pk
      - parent_id int fk -> categories.id null
      - slug text unique
  - name: products
    columns:
      - id uuid pk
      - category_id int fk -> categories.id idx
      - sku varchar(32) unique
      - price_cents int !null
  - name: orders
    columns:
      - id uuid pk
      - user_id uuid fk -> users.id !null idx
      - address_id uuid fk -> addresses.id
      - status enum(open,paid,shipped,cancelled)
      - placed_at timestamptz !null default=now()
  - name: order_items
    columns:
      - order_id uuid pk fk -> orders.id
      - product_id uuid pk fk -> products.id
      - qty int !null default=1
  - name: payments
    columns:
      - id uuid pk
      - order_id uuid fk -> orders.id unique
      - amount_cents int !null
      - provider_ref text
  - name: addresses
    columns:
      - id uuid pk
      - user_id uuid fk -> users.id idx
      - line1 text !null
      - country char(2) !null
  - name: reviews
    columns:
      - id uuid pk
      - product_id uuid fk -> products.id idx
      - user_id uuid fk -> users.id
      - rating smallint !null
  - name: order_totals
    kind: view
    note: Sum of line items per order.
    columns:
      - order_id uuid
      - total_cents bigint
relations:
  - users ||..o{ sessions: opens
  - users ||--o{ user_roles: has
  - roles ||--o{ user_roles: grants
  - users ||--o{ orders: places
  - users ||--o{ addresses: keeps
  - users ||..o{ reviews: writes
  - products ||--o{ reviews: gets
  - categories ||--o{ categories: parent of
  - categories ||--o{ products: lists
  - orders ||--|{ order_items: contains
  - products ||--o{ order_items: sold as
  - orders ||--o| payments: settled by
  - addresses ||--o{ orders: ships to
  - orders ||..o| order_totals: summarised by
```

## The same three tables in DBML

A ` ```dbml ` fence parses into an `erd` too — the fence stays DBML on disk until an edit rewrites it as YAML.

```dbml
Table users {
  id uuid [pk, default: `gen_random_uuid()`]
  email citext [unique, not null]
  created_at timestamptz [not null, default: `now()`]
}

Table orders {
  id uuid [pk]
  user_id uuid [not null, ref: > users.id]
  status order_status [default: 'open']
  placed_at timestamptz [not null, default: `now()`]
}

Table order_items {
  order_id uuid [pk, ref: > orders.id]
  product_id uuid [pk]
  qty int [not null, default: 1]
}

Enum order_status {
  open
  paid
  shipped
  cancelled
}
```
