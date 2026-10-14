# Terraform environment structure

**Register: guidance.** Apply when Terraform infrastructure exists or setup is planned. Do not copy these examples
verbatim into the generated instruction file.

When Terraform infrastructure is set up, use `infra/environments/<environment>/` for environment-specific inputs,
for example `infra/environments/dev/` under the repository root. Each environment has `backend.tfvars` for remote
state configuration and `terraform.tfvars` for deployment inputs. This is a confirmed convention, not a claim that
infrastructure already exists. Do not create infrastructure while merely authoring instructions. If setup is still
pending, record the future layout under Repo conventions with `(confirmed)`; once implemented, point at the actual
files. Preserve an existing conflicting layout unless the user authorizes migration.

## Backend configuration

For an Azure Storage backend, use this shape for `backend.tfvars`:

```hcl
resource_group_name  = "..."
storage_account_name = "..."
container_name       = "dev"
key                  = "terraform.tfstate"
use_azuread_auth     = true
```

Use the selected environment's container name, keeping state isolated between environments. Keep the backend
declaration in the Terraform root module; pass `backend.tfvars` explicitly to `terraform init -backend-config`.
It is backend configuration, not root-module variable input.

## Deployment inputs

The following `terraform.tfvars` is illustrative, not a required variable schema or a verified model catalogue.
Include only variables declared by the project. Choose a unique prefix, verify subscription quota, model/version
availability and supported regions, and obtain the real principal IDs before deployment. Replace image placeholders
with immutable Git-SHA tags or digests. Do not copy these project-specific values into unrelated repositories.

```hcl
subscription_id              = "00000000-0000-0000-0000-000000000000"
prefix                       = "taxadev"
location                     = "swedencentral"
ai_location                  = "swedencentral"
sql_location                 = "swedencentral"
model_name                   = "gpt-6-luna"
model_deployment_name        = "offers-chat-gpt6-luna"
model_version                = "2026-09-22"
sql_admin_object_id          = "00000000-0000-0000-0000-000000000000"
sql_admin_name               = "taxa-sql-admins"
container_image              = "taxa:replace-with-immutable-git-sha"
operator_container_image     = "taxa-operator:replace-with-immutable-git-sha"
operator_inbound_ipv4        = "203.0.113.10"

# Leave public IDs empty until enabled Vault secrets exist and the redirect URI output is registered.
microsoft_client_id = ""
google_client_id    = ""

# Dev operator, not an application principal: scoped Secrets Officer on this Vault.
oidc_secret_operator_object_id = ""

# App Service outbound IPs are discovered during planning; only time-boxed workstation IPs go here.
operator_resource_ip_allowlist = ["203.0.113.10"]
```

Keep both files free of secrets: Azure AD authenticates the backend; application secrets belong in the project's
secret store, not variable files. Public client IDs, principal IDs and resource names are configuration, not secrets.
Do not treat the example IP as a usable workstation address.

## Environment selection

Run Terraform from its root module, not from the environment input directory. For a root module at `infra/`, the
explicit development-environment commands, run from the repository root, are:

```sh
terraform -chdir=infra init -backend-config=environments/dev/backend.tfvars
terraform -chdir=infra plan -var-file=environments/dev/terraform.tfvars
```

Adapt paths to the actual root module and environment. Terraform does not automatically load a nested environment's
`terraform.tfvars`; plan/apply entrypoints must select it explicitly (or apply a saved plan created with it).
Use separate Terraform working/data directories per environment to avoid reusing another environment's cached
backend; do not automatically migrate state when changing environments.

In generated instructions, keep only the layout, file roles, safe environment selection and real command pointers.
Do not reproduce these sample values or entire variable files in the always-on harness.
