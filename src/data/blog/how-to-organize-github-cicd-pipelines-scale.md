---
title: How to organize Github CI/CD Pipelines at scale
author: Yohan GOUZERH
pubDatetime: 2025-07-13T10:28:00Z
slug: how-to-organize-github-cicd-pipelines-scale
featured: false
draft: false
tags:
  - Github
  - CICD
description:
  "How to organize GitHub CI/CD pipelines at scale using reusable actions, workflows, and best practices. Avoid maintenance nightmares with proper architecture for multi-project organizations."
timezone: "Asia/Hong_Kong"
---

> Writing CI/CD Pipelines on GitHub can be quite easy and straightforward for simple projects. However, when you need to manage multiple projects, you probably realized this too: maintaining all of that is a nightmare. I've encountered this plenty of times, where for one project, the workflow will be well polished and maintained... and then I need to go back and fix a bug on a half-baked workflow dating back multiple months, which is missing all the new features of the newer workflows.
>
> Plenty of CI/CD platforms have different best practices. I will share below an architecture that worked for me when working for a company using GitHub which handled a great number of projects. Feel free to take a look if you're interested.

## Table of contents

## GitHub Workflows

These are the initial things that you will create. For quick prototyping, putting everything there is great. However, when working in an organization with multiple projects, it's great to incorporate reusability.

## GitHub Actions

These are the killer feature of GitHub. Compared to other systems like Jenkins, where you will have to import plugins, here it's just some folders in a repo that can be called directly.

These are the smallest units of work in GitHub CI/CD.

You should put there any complex logic that you might have, and that could be reused by different workflows.

Here's an example of a simple GitHub Action that validates Docker images:

```yaml
# .github/actions/validate-docker/action.yml
name: 'Validate Docker Image'
description: 'Validates a Docker image by running basic health checks'
inputs:
  image-name:
    description: 'Name of the Docker image to validate'
    required: true
  registry:
    description: 'Container registry URL'
    required: false
    default: 'docker.io'
outputs:
  validation-result:
    description: 'Result of the validation (success/failure)'
    value: ${{ steps.validate.outputs.result }}
runs:
  using: 'composite'
  steps:
    - name: Pull and validate image
      id: validate
      shell: bash
      run: |
        echo "Pulling image ${{ inputs.registry }}/${{ inputs.image-name }}"
        docker pull "${{ inputs.registry }}/${{ inputs.image-name }}"
        
        # Run basic validation
        if docker run --rm "${{ inputs.registry }}/${{ inputs.image-name }}" --version; then
          echo "result=success" >> $GITHUB_OUTPUT
          echo "✅ Image validation successful"
        else
          echo "result=failure" >> $GITHUB_OUTPUT
          echo "❌ Image validation failed"
          exit 1
        fi
```

### Bash: a timeless tool

You will never be complained about when using Bash. I saw teammates getting under fire for choosing to write tools in Python or Go, when the manager had some special aversion to this or that technology, but Bash is a commonly agreed-upon tool by everyone.

The main reason is that it just works out of the box. It can be run anywhere, on a lightweight agent or on the local machine. No need to manage complex dependencies or build processes, which can be a headache when you are building a tool to manage dependencies and all.

> Note: sometimes, building a GitHub action using another programming language will make sense, like for example an action that will be a wrapper around a complex REST API. But I would recommend carefully evaluating when this is the case

Here's an example of a robust Bash-based GitHub Action for deploying to Kubernetes:

```bash
#!/bin/bash
# .github/actions/k8s-deploy/deploy.sh
set -euo pipefail

NAMESPACE="${1:-default}"
DEPLOYMENT_FILE="${2}"
IMAGE_TAG="${3}"

echo "🚀 Deploying to Kubernetes namespace: $NAMESPACE"

# Validate inputs
if [[ ! -f "$DEPLOYMENT_FILE" ]]; then
  echo "❌ Deployment file not found: $DEPLOYMENT_FILE"
  exit 1
fi

if [[ -z "$IMAGE_TAG" ]]; then
  echo "❌ Image tag is required"
  exit 1
fi

# Replace image tag in deployment file
sed -i "s|{{IMAGE_TAG}}|$IMAGE_TAG|g" "$DEPLOYMENT_FILE"

# Apply the deployment
kubectl apply -f "$DEPLOYMENT_FILE" -n "$NAMESPACE"

# Wait for rollout to complete
kubectl rollout status deployment/myapp -n "$NAMESPACE" --timeout=300s

echo "✅ Deployment completed successfully"
```

And the corresponding action.yml:

```yaml
# .github/actions/k8s-deploy/action.yml
name: 'Deploy to Kubernetes'
description: 'Deploy application to Kubernetes cluster'
inputs:
  namespace:
    description: 'Kubernetes namespace'
    required: false
    default: 'default'
  deployment-file:
    description: 'Path to Kubernetes deployment file'
    required: true
  image-tag:
    description: 'Docker image tag to deploy'
    required: true
runs:
  using: 'composite'
  steps:
    - name: Deploy
      shell: bash
      run: ${{ github.action_path }}/deploy.sh "${{ inputs.namespace }}" "${{ inputs.deployment-file }}" "${{ inputs.image-tag }}"
```

### How to test it

An often forgotten part is the testing. For that, if you are using Bash, a tool that I can recommend is bats. This will be able to quickly generate some tests for bash.
Every GitHub Action should be tested. GitHub workflows, as they have many side effects, might escape that. However, having a GitHub action that is well tested... that is the key to success

Here's an example of testing a GitHub Action using BATS:

```bash
# tests/k8s-deploy.bats
#!/usr/bin/env bats

setup() {
  # Create test deployment file
  cat > test-deployment.yml << EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test-app
spec:
  template:
    spec:
      containers:
      - name: app
        image: myapp:{{IMAGE_TAG}}
EOF
  
  # Mock kubectl command
  export PATH="$BATS_TEST_DIRNAME/mocks:$PATH"
}

teardown() {
  rm -f test-deployment.yml
}

@test "deploy.sh replaces image tag correctly" {
  # Run the script
  run bash .github/actions/k8s-deploy/deploy.sh "test-namespace" "test-deployment.yml" "v1.2.3"
  
  # Check that image tag was replaced
  grep "myapp:v1.2.3" test-deployment.yml
}

@test "deploy.sh fails with missing deployment file" {
  run bash .github/actions/k8s-deploy/deploy.sh "test-namespace" "nonexistent.yml" "v1.2.3"
  
  [ "$status" -eq 1 ]
  [[ "$output" == *"Deployment file not found"* ]]
}

@test "deploy.sh fails with empty image tag" {
  run bash .github/actions/k8s-deploy/deploy.sh "test-namespace" "test-deployment.yml" ""
  
  [ "$status" -eq 1 ]
  [[ "$output" == *"Image tag is required"* ]]
}
```

And a mock kubectl for testing:

```bash
# tests/mocks/kubectl
#!/bin/bash
# Mock kubectl for testing
echo "Mock kubectl called with: $*"
case "$1" in
  "apply")
    echo "deployment.apps/myapp configured"
    ;;
  "rollout")
    echo "deployment \"myapp\" successfully rolled out"
    ;;
esac
```

### How to organize your actions

1. Create a repo for all your GitHub actions

2. Create one folder per action

3. Add a .github folder, with a testing workflow for each action
  - You can either have one workflow per action, with a specific trigger that will call a reusable workflow, or instead have one main workflow that will trigger the testing based on the subpath modified. (One action that can be done to do that: [dorny/paths-filter](https://github.com/dorny/paths-filter))

Here's an example repository structure for organizing GitHub Actions:

```
github-actions/
├── .github/
│   └── workflows/
│       ├── test-k8s-deploy.yml
│       ├── test-validate-docker.yml
│       └── test-all-actions.yml
├── k8s-deploy/
│   ├── action.yml
│   ├── deploy.sh
│   └── tests/
│       ├── deploy.bats
│       └── mocks/
│           └── kubectl
├── validate-docker/
│   ├── action.yml
│   └── tests/
│       └── validate.bats
└── README.md
```

### How to release them

There are multiple schemes in the community.

However, I always prefer to use a simple and common scheme, SemVer: MAJOR.Minor.Patch, using a tag in the format `<action-name>-v<X.Y.Z>`, e.g., `deploy-kubernetes-v1.2.3`.

GitHub also recommends a dual tagging approach for actions:

1. **Semantic version tags**: `<action-name>-v1.2.3` for specific releases
2. **Major version tags**: `<action-name>-v1`, `<action-name>-v2` as moving tags pointing to the latest in that major version

This allows users to choose between:
- `uses: your-org/actions@action-name-v1` (automatic updates within major version)
- `uses: your-org/actions@action-name-v1.2.3` (pinned to specific version)

Some easy ways to remember how to use SemVer for GitHub actions:

- If you introduce something that changes the inputs or outputs: it's a breaking change, increase the major number
- If there is a bug that you fixed, but don't introduce anything new: increase the patch
- For everything else, increase the minor

This is quite important. Many people use patch by default. But this is a mistake. If you have v1.1.2 and v1.1.1, and you need to release a hotfix for v1.1.1... you are blocked. If you however have v1.1.0 and v1.2.0, you can release v1.1.1.

I recommend using [Conventional Commits]("https://www.conventionalcommits.org/en/v1.0.0/") to automate the process:

```
- feat(action-name)!: ... # For breaking changes --> major
- fix(action-name): ... # For bug fixes --> patch
- feat(action-name): ... # For everything else --> minor
```

### Build it in public

GitHub actions should be free of anything private or depending on something else.

Building in public will prevent you from creating dependencies on internal logic or secrets. For example, a good practice is to pass the info and secrets as inputs/secrets, instead of using organization variables or secrets. These should be passed by the caller job. This way you can have fully reusable tools.


## Reusable workflows

### When to choose to build them
A reusable workflow is a workflow that can be called from another one. I understand that it might be hard to distinguish when to use an action, a reusable workflow, or a workflow directly.

Main differentiators:

#### Actions vs Reusable Workflows

The main difference between actions and reusable workflows is that workflows can have jobs. Which means you can run things in parallel. Like a job to run unit tests, and another one to run e2e tests

Here's an example of a reusable workflow that runs multiple jobs in parallel:

```yaml
# .github/workflows/test-and-deploy.yml (reusable workflow)
name: Test and Deploy Application
on:
  workflow_call:
    inputs:
      environment:
        required: true
        type: string
      node-version:
        required: false
        type: string
        default: '18'
    secrets:
      DEPLOY_TOKEN:
        required: true
      DATABASE_URL:
        required: true

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ inputs.node-version }}
      - run: npm ci
      - run: npm run test:unit
      - run: npm run test:coverage

  e2e-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:13
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ inputs.node-version }}
      - run: npm ci
      - run: npm run test:e2e
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}

  lint-and-security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ inputs.node-version }}
      - run: npm ci
      - run: npm run lint
      - run: npm audit

  deploy:
    needs: [unit-tests, e2e-tests, lint-and-security]
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to ${{ inputs.environment }}
        run: echo "Deploying to ${{ inputs.environment }}"
        env:
          DEPLOY_TOKEN: ${{ secrets.DEPLOY_TOKEN }}
```

#### Workflows versus Reusable Workflows

The main difference between reusable workflows and workflows is that reusable workflows don't have triggers. Triggers can only be put in workflows directly.

Here's an example showing the difference:

**Regular workflow (with triggers):**
```yaml
# .github/workflows/ci.yml (in project repository)
name: CI Pipeline
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 2 * * 1'  # Every Monday at 2 AM

jobs:
  build:
    uses: company/workflows/.github/workflows/test-and-deploy.yml@v1.2.0
    with:
      environment: staging
      node-version: '18'
    secrets:
      DEPLOY_TOKEN: ${{ secrets.STAGING_DEPLOY_TOKEN }}
      DATABASE_URL: ${{ secrets.STAGING_DATABASE_URL }}
```

**Reusable workflow (no triggers):**
```yaml
# .github/workflows/test-and-deploy.yml (in shared workflows repository)
name: Test and Deploy Application
on:
  workflow_call:  # Only this trigger type allowed
    inputs:
      environment:
        required: true
        type: string
    secrets:
      DEPLOY_TOKEN:
        required: true

jobs:
  # ... job definitions here
```

Mostly, you will build reusable workflows when you have a "type" of project to deploy.

For example, one could be to build and deploy Cloudflare Workers. One could be to deploy on Kubernetes. These are different workflows that you need to define only once in the organization, and that you can reuse later


### Put them all in a mono-repo
These should also be in a mono-repo, under .github/workflows. One file per reusable workflow.

Here's an example repository structure for organizing reusable workflows:

```
company-workflows/
├── .github/
│   └── workflows/
│       ├── deploy-cloudflare-worker.yml
│       ├── deploy-kubernetes.yml
│       ├── test-node-app.yml
│       ├── test-python-app.yml
│       ├── build-docker-image.yml
│       └── security-scan.yml
├── README.md
└── docs/
    ├── deploy-cloudflare-worker.md
    ├── deploy-kubernetes.md
    └── usage-examples.md
```

Depending on the level of confidentiality needed, you can put them either in public or private. Some organizations might want to put them private in order to keep the information on how their CI/CD practices work confidential.

However, as there should be no use of secrets and variables directly, but passed by the workflow (similar to the GitHub actions as mentioned above), it's ok to put them public. Engineers in your team might enjoy this, which means they could reuse them for their own personal projects or reuse what they did when leaving the company.

Similar to GitHub Actions, for release management, create tags based on `<workflow-name>-<vX.Y.Z>`.


## How to plug everything together

- In the project, a workflow will define the trigger
- This workflow will call with the right inputs and secrets a versioned reusable workflow
- This reusable workflow will call the GitHub actions with the exact versions needed

Easy and simple!


## Additional bonus steps: automatic release management

In order to go beyond, if you have free time, you can implement the following as well:
- Automatic tag creation using Semantic Commits
- Automatic updates using Dependabot:
  Dependabot supports GitHub actions and reusable workflows version management. If you are following SemVer strictly, this allows you to have Dependabot automatically update the patch and minor versions, but send a PR to update the major version.


## Outro

I hope this can help you make sense of how to build a reusable and easy-to-maintain CI/CD system in your organization! Some recommendations:

- Start step by step, instead of changing everything in one go, even if it's tempting. I got burned many times trying to release everything perfectly the first time. Isolate the main reusable parts of your pipelines first. GitHub Actions and Workflows are quite pluggable, so you can have some quick wins first, and gradually expand it.

- Document everything. Documentation is crucial, not only for others but for yourself. This will help you when you need to fix something early in the morning, and the caffeine hasn't started kicking in yet.

Feel free to reach out if you have questions about implementing any of this - I'm always happy to chat about CI/CD architecture and the lessons learned from doing it wrong a few times first!




