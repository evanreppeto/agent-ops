#!/bin/sh
# Run git with Evan's GitHub identity as both author and committer.
# Vercel blocks deployments of commits whose author isn't on the team
# ("Vercel user not found"), and the cloud sandbox's default identity
# (agent-ops@users.noreply.github.com) isn't. Env vars beat any git config
# or sandbox default, so every commit a routine makes goes through this.
NAME="Evan Reppeto"
EMAIL="121970940+evanreppeto@users.noreply.github.com"
exec env GIT_AUTHOR_NAME="$NAME" GIT_AUTHOR_EMAIL="$EMAIL" \
  GIT_COMMITTER_NAME="$NAME" GIT_COMMITTER_EMAIL="$EMAIL" git "$@"
