# bolt.diy

Changes made where to the Search and File management functionality

## Hybrid Search & File Management

Bolt.diy now features a sophisticated hybrid system that combines multiple file system providers for optimal performance and reliability.

### 🔍 **Hybrid Search System**

The search functionality intelligently switches between different providers:

1. **CodeSandbox SDK** (Primary) - Cloud-based search with real-time indexing
2. **WebContainer** (Fallback) - Browser-based search when CodeSandbox is unavailable
3. **Local Mock** (Emergency Fallback) - In-memory search for offline development

**Features:**
- Real-time file content search across your entire project
- Support for regex patterns, case-sensitive/insensitive search
- Whole word matching and pattern exclusions
- Automatic provider selection based on availability
- Seamless fallback when primary provider fails

### 📁 **Hybrid File Management**

File operations work across multiple providers with intelligent fallback:

1. **CodeSandbox** - Cloud-based file system with persistence
2. **WebContainer** - Browser-based file system with local persistence  
3. **Local Fallback** - In-memory file system for offline use

**Features:**
- File upload and folder upload support
- Real-time file tree updates
- File creation, deletion, and directory management
- Automatic provider health monitoring
- Seamless fallback when primary provider fails

### 🔧 **CodeSandbox Integration**

To use the CodeSandbox features, you'll need to set up an API key:

#### Setting up CodeSandbox API Key

1. **Create a CodeSandbox Account:**
   - Visit [codesandbox.io](https://codesandbox.io)
   - Sign up for a free account

2. **Generate API Key:**
   - Go to your [CodeSandbox Settings](https://codesandbox.io/dashboard/settings)
   - Navigate to the Settings -> "API" section
   - Generate a new API key

3. **Add to Environment Variables:**
   Create a `.env` file in your project root:
   ```bash
   VITE_CSB_API_KEY=your_codesandbox_api_key_here
   ```

4. **Restart the Development Server:**
   ```bash
   pnpm run dev
   ```

> **Note**: The CodeSandbox API key is optional. If not provided, the system will automatically fall back to WebContainer and local file systems.

#### Fallback Behavior

When CodeSandbox is unavailable (network issues, API limits, etc.), the system automatically falls back:

```
CodeSandbox → WebContainer → Local Mock
```

- **CodeSandbox fails** → Uses WebContainer for file operations
- **WebContainer fails** → Uses local in-memory file system
- **All providers fail** → Graceful error handling with user feedback

### 🧪 **Testing the Hybrid Features**

1. **Test Search:**
   - Navigate to the search interface
   - Try searching for code patterns
   - Watch the console for provider selection logs

2. **Test File Management:**
   - **Access the Test Route**: Navigate to `http://localhost:5173/test-file-management`
   - Upload files or folders using the drag-and-drop interface
   - Create sample files and directories using the provided buttons
   - Monitor provider status in the UI
   - View the file tree structure in real-time
   - Test the fallback mechanisms by disconnecting from the internet

3. **Test Fallback:**
   - Disconnect from internet to test local fallback
   - Check console logs for fallback behavior
   - Verify that file operations still work in offline mode

### 🧪 **Test Routes**

The project includes dedicated test routes for development and debugging:

#### **File Management Test Route**
- **URL**: `http://localhost:5173/test-file-management`
- **Purpose**: Test the hybrid file management implementation
- **Features**:
  - File upload and folder upload interface
  - Real-time file tree display
  - Provider status monitoring
  - Sample file and directory creation
  - Implementation details and documentation
  - Usage instructions and troubleshooting

#### **Accessing Test Routes**
1. Start the development server: `pnpm run dev`
2. Open your browser and navigate to the test route
3. Use the interface to test file operations
4. Monitor the browser console for detailed logs
5. Check the provider status indicators

> **Note**: Test routes are development tools and may not be available in production builds.

### 📊 **Provider Status Monitoring**

The system provides real-time status information:
- **Provider Type**: CodeSandbox, WebContainer, or Local
- **Connection Status**: Ready, Loading, or Error
- **Health Checks**: Automatic monitoring of provider availability
- **Error Reporting**: Detailed error messages for debugging

## Limitations and Issues faced

Had issues relating to connecting with the CodeSandbox sandbox after creation, this initially worked, but stopped along the way with multiple errors. Due to little documentations or example on using the SDK v2, this issue wasnt fixed and affected the task greatly.

Also, I did some research and saw that replacing a webcontainer with a CodeSandbox/VM looks like an issue currently discussed, and would require significant effort to get it implemented(Unfortunately cant be done in 2  - 3 days). 

A similar implementation of the proposed task would be the Lovable project.


## Setup

If you're new to installing software from GitHub, don't worry! If you encounter any issues, feel free to submit an "issue" using the provided links or improve this documentation by forking the repository, editing the instructions, and submitting a pull request. The following instruction will help you get the stable branch up and running on your local machine in no time.

Let's get you up and running with the stable version of Bolt.DIY!

## Quick Download

[![Download Latest Release](https://img.shields.io/github/v/release/stackblitz-labs/bolt.diy?label=Download%20Bolt&sort=semver)](https://github.com/stackblitz-labs/bolt.diy/releases/latest) ← Click here to go the the latest release version!

- Next **click source.zip**

## Prerequisites

Before you begin, you'll need to install two important pieces of software:

### Install Node.js

Node.js is required to run the application.

1. Visit the [Node.js Download Page](https://nodejs.org/en/download/)
2. Download the "LTS" (Long Term Support) version for your operating system
3. Run the installer, accepting the default settings
4. Verify Node.js is properly installed:
   - **For Windows Users**:
     1. Press `Windows + R`
     2. Type "sysdm.cpl" and press Enter
     3. Go to "Advanced" tab → "Environment Variables"
     4. Check if `Node.js` appears in the "Path" variable
   - **For Mac/Linux Users**:
     1. Open Terminal
     2. Type this command:
        ```bash
        echo $PATH
        ```
     3. Look for `/usr/local/bin` in the output

## Running the Application

You have two options for running Bolt.DIY: directly on your machine or using Docker.

### Option 1: Direct Installation (Recommended for Beginners)

1. **Install Package Manager (pnpm)**:

   ```bash
   npm install -g pnpm
   ```

2. **Install Project Dependencies**:

   ```bash
   pnpm install
   ```

3. **Start the Application**:

   ```bash
   pnpm run dev
   ```
   
### Option 2: Using Docker

This option requires some familiarity with Docker but provides a more isolated environment.

#### Additional Prerequisite

- Install Docker: [Download Docker](https://www.docker.com/)

#### Steps:

1. **Build the Docker Image**:

   ```bash
   # Using npm script:
   npm run dockerbuild

   # OR using direct Docker command:
   docker build . --target bolt-ai-development
   ```

2. **Run the Container**:
   ```bash
   docker compose --profile development up
   ```

## Configuring API Keys and Providers

### Adding Your API Keys

Setting up your API keys in Bolt.DIY is straightforward:

1. Open the home page (main interface)
2. Select your desired provider from the dropdown menu
3. Click the pencil (edit) icon
4. Enter your API key in the secure input field

![API Key Configuration Interface](./docs/images/api-key-ui-section.png)

### CodeSandbox API Key Setup

For the hybrid search and file management features, you'll need a CodeSandbox API key:

1. **Create a CodeSandbox Account:**
   - Visit [codesandbox.io](https://codesandbox.io)
   - Sign up for a free account

2. **Generate API Key:**
   - Go to your [CodeSandbox Settings](https://codesandbox.io/dashboard/settings)
   - Navigate to the "API" section
   - Generate a new API key

3. **Add to Environment Variables:**
   Create a `.env` file in your project root:
   ```bash
   VITE_CSB_API_KEY=your_codesandbox_api_key_here
   ```

## Setup Using Git (For Developers only)

This method is recommended for developers who want to:

- Contribute to the project
- Stay updated with the latest changes
- Switch between different versions
- Create custom modifications

#### Prerequisites

1. Install Git: [Download Git](https://git-scm.com/downloads)

#### Initial Setup

1. **Clone the Repository**:

   ```bash
   git clone -b stable https://github.com/stackblitz-labs/bolt.diy.git
   ```

2. **Navigate to Project Directory**:

   ```bash
   cd bolt.diy
   ```

3. **Install Dependencies**:

   ```bash
   pnpm install
   ```

4. **Start the Development Server**:
   ```bash
   pnpm run dev
   ```

5. **(OPTIONAL)** Switch to the Main Branch if you want to use pre-release/testbranch:
   ```bash
   git checkout main
   pnpm install
   pnpm run dev
   ```
  Hint: Be aware that this can have beta-features and more likely got bugs than the stable release

>**Open the WebUI to test (Default: http://localhost:5173)**
>   - Beginngers: 
>     - Try to use a sophisticated Provider/Model like Anthropic with Claude Sonnet 3.x Models to get best results
>     - Explanation: The System Prompt currently implemented in bolt.diy cant cover the best performance for all providers and models out there. So it works better with some models, then other, even if the models itself are perfect for >programming
>     - Future: Planned is a Plugin/Extentions-Library so there can be different System Prompts for different Models, which will help to get better results

#### Staying Updated

To get the latest changes from the repository:

1. **Save Your Local Changes** (if any):

   ```bash
   git stash
   ```

2. **Pull Latest Updates**:

   ```bash
   git pull 
   ```

3. **Update Dependencies**:

   ```bash
   pnpm install
   ```

4. **Restore Your Local Changes** (if any):
   ```bash
   git stash pop
   ```

#### Troubleshooting Git Setup

If you encounter issues:

1. **Clean Installation**:

   ```bash
   # Remove node modules and lock files
   rm -rf node_modules pnpm-lock.yaml

   # Clear pnpm cache
   pnpm store prune

   # Reinstall dependencies
   pnpm install
   ```

2. **Reset Local Changes**:
   ```bash
   # Discard all local changes
   git reset --hard origin/main
   ```

Remember to always commit your local changes or stash them before pulling updates to avoid conflicts.

#### Troubleshooting Hybrid Features

If you encounter issues with search or file management:

1. **CodeSandbox Connection Issues:**
   - Check your internet connection
   - Verify your API key is correct in `.env`
   - Check browser console for DataView errors (known issue with some browsers)
   - The system will automatically fall back to WebContainer

2. **Search Not Working:**
   - Open browser console (F12) to see provider status
   - Check if files are properly loaded in the file tree
   - Try refreshing the page to reinitialize providers

3. **File Upload Issues:**
   - Ensure you have proper file permissions
   - Check browser console for error messages
   - Try using smaller files or folders first

4. **Provider Status:**
   - Monitor the provider status in the UI
   - Look for "Ready", "Loading", or "Error" indicators
   - Check console logs for detailed error information

5. **Fallback Testing:**
   - Disconnect from internet to test local fallback
   - Check that file operations still work offline
   - Verify search functionality in fallback mode

---

## Available Scripts

- **`pnpm run dev`**: Starts the development server.
- **`pnpm run build`**: Builds the project.
- **`pnpm run start`**: Runs the built application locally using Wrangler Pages.
- **`pnpm run preview`**: Builds and runs the production build locally.
- **`pnpm test`**: Runs the test suite using Vitest.
- **`pnpm run typecheck`**: Runs TypeScript type checking.
- **`pnpm run typegen`**: Generates TypeScript types using Wrangler.
- **`pnpm run deploy`**: Deploys the project to Cloudflare Pages.
- **`pnpm run lint:fix`**: Automatically fixes linting issues.

---

## Contributing

We welcome contributions! Check out our [Contributing Guide](CONTRIBUTING.md) to get started.

---

## Roadmap

Explore upcoming features and priorities on our [Roadmap](https://roadmap.sh/r/ottodev-roadmap-2ovzo).

---

## FAQ

For answers to common questions, issues, and to see a list of recommended models, visit our [FAQ Page](FAQ.md).


# Licensing
**Who needs a commercial WebContainer API license?**

bolt.diy source code is distributed as MIT, but it uses WebContainers API that [requires licensing](https://webcontainers.io/enterprise) for production usage in a commercial, for-profit setting. (Prototypes or POCs do not require a commercial license.) If you're using the API to meet the needs of your customers, prospective customers, and/or employees, you need a license to ensure compliance with our Terms of Service. Usage of the API in violation of these terms may result in your access being revoked.
