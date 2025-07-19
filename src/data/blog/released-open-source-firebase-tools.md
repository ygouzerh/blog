---
title: Released some open-source firebase tools for everyone to use
author: Yohan GOUZERH
pubDatetime: 2025-07-19T14:45:00Z
slug: released-open-source-firebase-tools
featured: false
draft: false
tags:
  - Firebase
  - Tools
  - Open Source
description:
  "Released a collection of open-source Firebase tools to simplify working with Firestore, without having to pay for paid tools"
timezone: "Asia/Hong_Kong"
---

> I was working on recreating some Firebase environments these days. It was my first time with Firebase. I fumbled around the UI, the CLI... However, as I quickly discovered, like some of my colleagues told me before:
The tooling is quite limiting. Everything is mostly done using the SDK, and the UI and CLI are quite basic. There are some tools around that can help, like Firefoo, however it's mostly paid.
I will introduce below some tools that I built for this job, and hopefully they could help you too.

## Table of contents

## Disclaimer

All the tools below are available in the following repository: [ygouzerh/firebase-tools](https://github.com/ygouzerh/firebase-tools)

These tools have been made mostly for helping myself, I am just sharing them here for everyone, in case they can help you. They might be full of bugs however. I put them under MIT License, feel free to fork and make your own.

## Tool n°1: Firestore import / export

This was the first tool that I created. I realized quite quickly that adding entries one by one in Firestore is going to be a mess. This one helps to do the following:
1. Export collections from a current Firestore
2. Then, it will put them under a specific folder, for you to modify. This gives you the base, so you can modify it easily.
3. Once you are ready, you can import the collections you want

> Note: You can also ignore the export step and go directly to the import part

### Export your existing database

First, set up your environment variables and run the export:

```bash
# Set your service account path and project ID
export FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/service-account.json
export FIREBASE_PROJECT_ID=your-project-id

# Run the export
./run_export.sh
```

This will create a `firestore_export/` directory with individual collection files like `users.json`, `products.json`, etc.

### Import to your new database

If you are performing a new environment creation, you can leverage the files exported, using

```bash
# Copy files from export to import directory
cp firestore_export/*.json firestore_import/
```

And then, you can modify the files as you see fit.

Otherwise, just add one file per collection, in `firestore_import/`.

Now, you can run the import:

```bash
# Set target project ID
export FIREBASE_PROJECT_ID=your-target-project-id

# Optional: Enable dry-run mode first (recommended)
export DRY_RUN=true

# Run the import
./run_import.sh
```

The tool will show you available collections and let you choose interactively:

```
📋 Available collections for import:
   1. admins
   2. applications  
   3. users

💡 Enter collection numbers (1-3) separated by commas,
   or 'all' to import all collections, or 'quit' to exit:
👉 Your selection: 1,3
```

## Tool n°2: Update user claims

Users can have some custom data that would be used later on by the application. One for us was to determine if a user has been approved or not (KYC). When we are creating testing accounts, you don't want to go through all the onboarding process however.

Instead, you can use this tool directly to add the claims you want.

The only thing you have to do:

Just add a claims.json, and then you can call your script using the following flow:

### Setup your claims

Create a `claims.json` file with the claims you want to set:

```json
{
  "role": 1,
  "permissions": ["read", "write"],
  "level": "admin",
  "kyc_approved": true
}
```

### Run the tool

```bash
yarn update-claims <user-id> <service-account-path>
```

Example:
```bash
yarn update-claims abc123def456 ./path/to/my-project-service-account.json
```

This will output:
```
Successfully updated claims for user abc123def456 in project my-project-id
Custom claims set: {
  "role": 1,
  "permissions": ["read", "write"],
  "level": "admin",
  "kyc_approved": true
}
```

## Tool n°3: Automatically verify user email

In continuation of the workflow of user creation, you may want to automatically verify a user email, without having to log into the user email, which could sometimes be a bit of a constraint if your organization needs you to raise some tickets to have access to it.

Instead, you can just run the following, and it will automatically do it for you.

### Basic usage with confirmation prompt

```bash
yarn verify-email <user-id> <service-account-path>
```

Example:
```bash
yarn verify-email abc123def456 ./service-accounts/my-project-service-account.json
```

### Expected output

```
User found: user@example.com
Current email verification status: false

⚠️  This will mark the email as verified without sending a verification email.
Press Ctrl+C to cancel, or use --force flag to skip this prompt.
Continuing in 5 seconds...

✅ Successfully marked email as verified for user abc123def456 in project my-project-id
Email: user@example.com
```


## Outro

This is all for now! Feel free to check out the repository and give these tools a try. I hope these tools can save you some time when working with Firebase, just like they did for me.
