# Agentic Flow

> **AgencyOS: Agentic Flow**
> An advanced terminal interface for AI agent orchestration.

## Overview

The **Agentic Flow** is a terminal-based workspace designed for collaborative AI development. It orchestrates specialized agents through a structured pipeline: Plan, Build, Review, and Deploy.

### Key Features

- **⚡ Terminal Interface**: A command-line style interface for interacting with agents and the shell.
- **🔄 Execution Pipeline**:
    - **Architect (Plan)**: Designs the system architecture and implementation plan.
    - **Engineer (Build)**: Implements the code based on the plan.
    - **Critic (Review)**: Reviews code for security and best practices.
    - **Deployer (Deploy)**: Manages deployment and infrastructure.
- **📊 Live Metrics**: Real-time tracking of token usage, phase duration, and success rates.
- **📋 Execution Plan**: Visual progress tracking of agent tasks and subtasks.

## Tech Stack

- **Framework**: Next.js (App Router)
- **Styling**: TailwindCSS
- **State**: React State & Context
- **Icons**: Lucide React

## Getting Started

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Run Development Server**
   ```bash
   npm run dev
   ```

3. **Open the Terminal**
   Navigate to `http://localhost:3000`.

## Architecture

The application uses a role-based state machine. The `TerminalLayout` orchestrates the flow between agents, maintaining the history of outputs and the state of the execution plan.

## Design

The UI follows a "Linear-inspired" dark mode aesthetic with high contrast, minimal chrome, and semantic color coding for different agent roles.
