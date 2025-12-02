# Wrangler Commands Cheatsheet

Quick reference for common Wrangler CLI commands.

## Development

```bash
# Start local dev server
wrangler dev
wrangler dev --remote              # Use remote resources
wrangler dev --port 3000           # Custom port
wrangler dev --local-protocol https # HTTPS locally
wrangler dev --live-reload         # Auto-reload on changes

# View logs in real-time
wrangler tail
wrangler tail --env production
wrangler tail --status error       # Filter by status
wrangler tail --method POST        # Filter by HTTP method
wrangler tail --search "keyword"   # Search logs
wrangler tail --format pretty      # Pretty print
```

## Deployment

```bash
# Deploy Worker
wrangler deploy
wrangler deploy --env staging      # Deploy to environment
wrangler deploy --dry-run          # Validate without deploying
wrangler deploy --compatibility-date 2024-01-01

# Manage deployments
wrangler deployments list
wrangler deployments view <id>
wrangler rollback <deployment-id>

# Legacy (same as deploy)
wrangler publish
```

## KV Namespace

```bash
# Create namespace
wrangler kv:namespace create NAMESPACE_NAME
wrangler kv:namespace create NAMESPACE_NAME --preview

# List namespaces
wrangler kv:namespace list

# Delete namespace
wrangler kv:namespace delete --namespace-id=xxx

# Put/Get/Delete keys
wrangler kv:key put KEY "value" --namespace-id=xxx
wrangler kv:key put KEY --path=file.txt --namespace-id=xxx
wrangler kv:key get KEY --namespace-id=xxx
wrangler kv:key delete KEY --namespace-id=xxx

# List keys
wrangler kv:key list --namespace-id=xxx
wrangler kv:key list --prefix="user:" --namespace-id=xxx

# Bulk operations
wrangler kv:bulk put data.json --namespace-id=xxx
wrangler kv:bulk delete keys.json --namespace-id=xxx
```

## D1 Database

```bash
# Create database
wrangler d1 create DATABASE_NAME

# List databases
wrangler d1 list

# Delete database
wrangler d1 delete DATABASE_NAME

# Execute SQL
wrangler d1 execute DB --command="SELECT * FROM users"
wrangler d1 execute DB --file=query.sql
wrangler d1 execute DB --remote --command="..."  # Production

# Migrations
wrangler d1 migrations create DB migration_name
wrangler d1 migrations list DB
wrangler d1 migrations apply DB               # Local
wrangler d1 migrations apply DB --remote      # Production

# Export data
wrangler d1 export DB --output=backup.sql
wrangler d1 export DB --remote --output=prod-backup.sql
```

## R2 Buckets

```bash
# Create bucket
wrangler r2 bucket create BUCKET_NAME
wrangler r2 bucket create BUCKET_NAME --jurisdiction eu

# List buckets
wrangler r2 bucket list

# Delete bucket
wrangler r2 bucket delete BUCKET_NAME

# Object operations
wrangler r2 object put BUCKET/key --file=local.txt
wrangler r2 object get BUCKET/key --file=output.txt
wrangler r2 object delete BUCKET/key
wrangler r2 object list BUCKET
wrangler r2 object list BUCKET --prefix="uploads/"
```

## Vectorize

```bash
# Create index
wrangler vectorize create INDEX_NAME --dimensions=768 --metric=cosine
wrangler vectorize create INDEX_NAME --preset="@cf/baai/bge-base-en-v1.5"

# List indexes
wrangler vectorize list

# Get index info
wrangler vectorize get INDEX_NAME

# Delete index
wrangler vectorize delete INDEX_NAME

# Insert vectors (from NDJSON file)
wrangler vectorize insert INDEX_NAME --file=vectors.ndjson

# Query (from NDJSON file)
wrangler vectorize query INDEX_NAME --file=query.ndjson
```

## Queues

```bash
# Create queue
wrangler queues create QUEUE_NAME

# List queues
wrangler queues list

# Delete queue
wrangler queues delete QUEUE_NAME

# Send message
wrangler queues producer send QUEUE_NAME --message='{"data":"value"}'

# View consumers
wrangler queues consumer list QUEUE_NAME
```

## Secrets

```bash
# Add secret (interactive)
wrangler secret put SECRET_NAME
wrangler secret put SECRET_NAME --env production

# Add secret from file
echo "secret-value" | wrangler secret put SECRET_NAME

# List secrets (names only, not values)
wrangler secret list
wrangler secret list --env production

# Delete secret
wrangler secret delete SECRET_NAME
wrangler secret delete SECRET_NAME --env production

# Bulk secrets (from JSON)
wrangler secret bulk secrets.json
```

## Durable Objects

```bash
# List Durable Objects
wrangler durable-objects namespace list

# Get object IDs
wrangler durable-objects namespace get NAMESPACE_ID

# Delete Durable Object
wrangler durable-objects delete NAMESPACE_ID OBJECT_ID
```

## Pages

```bash
# Create Pages project
wrangler pages project create PROJECT_NAME

# Deploy to Pages
wrangler pages deploy ./dist
wrangler pages deploy ./dist --project-name=my-project

# List deployments
wrangler pages deployment list

# Tail Pages logs
wrangler pages deployment tail
```

## Project Management

```bash
# Initialize new project
npm create cloudflare@latest
npm create cloudflare@latest my-worker -- --template=worker-typescript

# Delete Worker
wrangler delete
wrangler delete --name WORKER_NAME

# View Worker details
wrangler whoami
wrangler deployments list
```

## Configuration

```bash
# Initialize wrangler.toml
wrangler init
wrangler init my-worker

# Login
wrangler login
wrangler logout

# Check auth status
wrangler whoami

# Update Wrangler
npm update -g wrangler
```

## Types & Type Generation

```bash
# Generate types for bindings
wrangler types

# Output types to specific file
wrangler types --output=src/worker-configuration.d.ts
```

## Workflows (Beta)

```bash
# List workflows
wrangler workflows list

# Get workflow details
wrangler workflows describe WORKFLOW_NAME

# View workflow instances
wrangler workflows instances list WORKFLOW_NAME
wrangler workflows instances describe WORKFLOW_NAME INSTANCE_ID

# Delete instance
wrangler workflows instances delete WORKFLOW_NAME INSTANCE_ID
```

## Analytics Engine

```bash
# Query analytics
wrangler analytics --dataset=workers_trace
```

## Environment-Specific Commands

Most commands support `--env` flag:

```bash
# Development
wrangler deploy --env development
wrangler tail --env development
wrangler d1 execute DB --env development --remote

# Staging
wrangler deploy --env staging
wrangler secret put API_KEY --env staging

# Production
wrangler deploy --env production
wrangler tail --env production
```

## Useful Flags

```bash
# Global flags
--help                 # Show help
--version              # Show version
--config <path>        # Custom config file
--env <environment>    # Target environment

# Common command flags
--remote               # Use remote resources
--dry-run              # Validate without executing
--json                 # Output as JSON
--compatibility-date   # Set compatibility date
--persist-to <path>    # Local persistence directory
```

## Quick Workflow Examples

### New Worker Project

```bash
npm create cloudflare@latest my-worker
cd my-worker
wrangler dev
wrangler deploy
```

### Add KV to Existing Worker

```bash
wrangler kv:namespace create MY_KV
# Add binding to wrangler.jsonc
wrangler deploy
```

### D1 Database Setup

```bash
wrangler d1 create my-db
# Add binding to wrangler.jsonc
wrangler d1 migrations create my-db initial_schema
# Edit migration SQL
wrangler d1 migrations apply my-db
wrangler d1 migrations apply my-db --remote
```

### Deploy with Secrets

```bash
wrangler secret put API_KEY
wrangler secret put DATABASE_URL
wrangler deploy
```

### Debugging Production Issues

```bash
# View real-time logs
wrangler tail

# View error logs only
wrangler tail --status error

# Search for specific pattern
wrangler tail --search "user-id-123"

# Check recent deployments
wrangler deployments list

# Rollback if needed
wrangler rollback <deployment-id>
```

## Getting Help

```bash
# General help
wrangler --help

# Command-specific help
wrangler dev --help
wrangler deploy --help
wrangler d1 --help
wrangler kv:namespace --help
```

For the latest commands and options, visit:
- https://developers.cloudflare.com/workers/wrangler/commands/
- Or use: `wrangler <command> --help`
