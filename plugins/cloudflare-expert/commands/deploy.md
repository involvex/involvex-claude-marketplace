---
name: deploy
description: Automated deployment workflow with pre-flight checks, validation, testing, and deployment to Cloudflare Workers
argument-hint: "[--env <environment>] [--dry-run]"
allowed-tools: ["Read", "Grep", "Bash", "Write", "Edit"]
---

# Cloudflare Deployment Workflow

Automated deployment workflow with comprehensive pre-flight checks and validation before deploying to Cloudflare Workers.

## What This Command Does

1. **Validates configuration**: Checks wrangler.jsonc/wrangler.toml is properly configured
2. **Checks compatibility date**: Warns if compatibility_date is old
3. **Verifies bindings**: Ensures all referenced bindings exist
4. **Runs tests**: Executes `npm test` if test script exists
5. **Runs build**: Executes `npm run build` if build script exists
6. **Confirms deployment**: Shows what will be deployed and asks for confirmation
7. **Executes deployment**: Runs `wrangler deploy`
8. **Verifies success**: Checks deployment succeeded
9. **Updates memory**: Saves deployment details to living memory (if successful)
10. **Monitors**: Offers to tail logs after deployment

## Process

### Step 1: Validate Configuration

Read and validate wrangler configuration:
- Locate wrangler.jsonc or wrangler.toml
- Verify required fields (name, main, compatibility_date)
- Check entry point file exists
- Validate binding configurations (KV, D1, R2, etc.)
- Parse environment if `--env` flag provided

### Step 2: Check Compatibility Date

Check compatibility_date:
- If older than 6 months, warn user it's outdated
- Suggest updating to recent date
- Offer to update automatically if user agrees

### Step 3: Verify Bindings

For each binding in configuration:
- **KV**: Check namespace exists (if possible)
- **D1**: Verify database exists
- **R2**: Verify bucket exists
- **Vectorize**: Check index exists

If bindings don't exist, inform user and offer to create them.

### Step 4: Check for D1 Migrations

If D1 bindings exist:
- Check if migrations/ directory exists
- List pending migrations: `wrangler d1 migrations list DB [--env ENV] [--remote]`
- If pending migrations, ask user:
  - "You have pending D1 migrations. Apply them before deploying?"
  - If yes, run: `wrangler d1 migrations apply DB [--env ENV] --remote`

### Step 5: Run Tests (if available)

Check package.json for test script:
- If `"test"` script exists and is not placeholder ("echo \"Error...")
- Run: `npm test`
- If tests fail, ask user:
  - "Tests failed. Continue with deployment anyway? (not recommended)"
  - If no, abort deployment

### Step 6: Run Build (if available)

Check package.json for build script:
- If `"build"` script exists
- Run: `npm run build`
- If build fails, abort deployment

### Step 7: Dry Run (if --dry-run flag)

If user provided `--dry-run` flag:
```bash
wrangler deploy --dry-run [--env ENV]
```

Show results and exit (don't deploy).

### Step 8: Confirm Deployment

Show user what will be deployed:
```
Ready to deploy:
- Worker: my-worker
- Environment: production (or default if no --env)
- Entry point: src/index.ts
- Bindings: KV (CACHE), D1 (DB), R2 (UPLOADS)
- Compatibility date: 2024-01-15
```

Ask for confirmation:
- "Deploy to **[environment]**? (yes/no)"
- If production/no --env, add extra warning:
  - "⚠️  This will deploy to PRODUCTION. Are you sure?"

### Step 9: Execute Deployment

Run wrangler deploy:
```bash
wrangler deploy [--env ENV]
```

Show verbose output so user sees progress.

### Step 10: Verify Deployment

Check if deployment succeeded:
- Look for success message in output
- If successful, show deployment URL
- List recent deployments: `wrangler deployments list [--env ENV]`

### Step 11: Update Living Memory

If deployment successful and living memory exists:
- Update `.claude/cloudflare-expert.local.md`
- Add to "Recent Deployments" section:
  ```
  - [YYYY-MM-DD HH:MM] Deployed to [environment]
    - Worker: [name]
    - Version: [if tracked]
    - Bindings: [list]
  ```

Prompt user: "Would you like me to remember this deployment configuration?"

### Step 12: Post-Deployment Options

Offer user next steps:
1. "Monitor logs with `wrangler tail [--env ENV]`?"
2. "Test the deployment at [URL]?"
3. "View deployment details?"

If user wants logs, run:
```bash
wrangler tail [--env ENV]
```

## Common Issues and Solutions

### Issue: Authentication required
**Solution**: Run `wrangler login` or set CLOUDFLARE_API_TOKEN

### Issue: Binding not found
**Solution**:
- Check binding exists: `wrangler kv:namespace list` (for KV)
- Verify binding ID matches wrangler.jsonc
- Create missing binding if needed

### Issue: Migration not applied
**Solution**:
```bash
wrangler d1 migrations apply DB --env production --remote
```

### Issue: Compatibility date too old
**Solution**: Update wrangler.jsonc:
```jsonc
{
  "compatibility_date": "2024-01-15"  // Use recent date
}
```

### Issue: Tests failing
**Solution**:
- Fix tests before deploying
- Or use `--dry-run` to validate config without deploying
- Or acknowledge risk and proceed (not recommended)

### Issue: Deployment failed
**Solution**:
- Check error message
- Verify all bindings exist
- Ensure migrations applied
- Check authentication
- Validate wrangler.jsonc syntax

## Usage Examples

**Deploy to production** (default):
```
/cloudflare:deploy
```

**Deploy to staging**:
```
/cloudflare:deploy --env staging
```

**Dry run** (validate without deploying):
```
/cloudflare:deploy --dry-run
```

**Deploy to specific environment with dry run**:
```
/cloudflare:deploy --env production --dry-run
```

## Important Notes

- Always show verbose output for transparency
- Run pre-flight checks even if user is experienced
- Warn loudly when deploying to production
- Offer to apply D1 migrations before deploying
- Run tests if they exist (don't skip silently)
- Update living memory after successful deployment
- Offer post-deployment monitoring

## Safety Features

1. **Double confirmation for production**: Extra prompt for production deploys
2. **Test enforcement**: Won't deploy if tests fail (unless user overrides)
3. **Migration warnings**: Alerts about pending migrations
4. **Dry run option**: Validate without deploying
5. **Deployment verification**: Confirms deployment succeeded

## References

- Use `deployment-strategies` skill for CI/CD and deployment patterns
- Use `wrangler-workflows` skill for wrangler commands
- Use `cloudflare-platform` skill for binding questions

Auto-activate relevant skills as needed during the workflow.
