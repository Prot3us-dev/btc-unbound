#!/bin/bash

# Define the tmux session name
SESSION_NAME="npm_runner"

# Create a new tmux session or attach to an existing one
tmux has-session -t $SESSION_NAME 2>/dev/null

if [ $? != 0 ]; then
    echo "Starting a new tmux session named '$SESSION_NAME'."
    tmux new-session -d -s $SESSION_NAME
else
    echo "Re-attaching to existing tmux session '$SESSION_NAME'."
    tmux attach-session -t $SESSION_NAME
    exit
fi

# Run the loop command inside the tmux session
tmux send-keys -t $SESSION_NAME "
trap 'echo Interrupted! Exiting...' SIGINT
while true; do
    npm run start
    echo 'Program crashed or stopped. Restarting in 1 seconds...'
    sleep 1
done
" C-m

# Attach to the tmux session
tmux attach -t $SESSION_NAME
