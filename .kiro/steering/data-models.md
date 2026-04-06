---
inclusion: manual
description: 核心实体关系、AI/同步模型、存储键速查
---

# 数据模型参考

## 核心实体关系

```
Host
├── identityId → Identity (可选，引用可复用身份)
├── identityFileId → SSHKey (可选，引用 SSH 密钥)
├── proxyConfig → ProxyConfig (HTTP/SOCKS5 代理)
├── hostChain → HostChainConfig (跳板机链)
├── environmentVariables → EnvVar[] (环境变量)
├── serialConfig → SerialConfig (串口配置)
├── sftpBookmarks → SftpBookmark[] (SFTP 书签)
└── group → string (层级分组路径，如 "AWS/Production")

Identity
├── username: string
├── authMethod: 'password' | 'key' | 'certificate'
└── keyId → SSHKey (可选)

SSHKey
├── type: 'RSA' | 'ECDSA' | 'ED25519'
├── category: 'key' | 'certificate' | 'identity'
├── source: 'generated' | 'imported'
├── privateKey / publicKey / certificate
└── passphrase (可选，加密存储)

TerminalSession
├── hostId → Host
├── workspaceId → Workspace (可选)
├── protocol: 'ssh' | 'telnet' | 'local' | 'serial' | 'mosh'
├── status: 'connecting' | 'connected' | 'disconnected' | 'error'
└── serialConfig → SerialConfig (串口会话)

Workspace
├── root: WorkspaceNode (树形分割布局)
│   ├── type: 'pane' → sessionId
│   └── type: 'split' → direction + children[] + sizes[]
├── focusedSessionId: string
└── viewMode: 'split' | 'focus'

PortForwardingRule
├── hostId → Host
├── type: 'local' | 'remote' | 'dynamic'
├── sourcePort / destHost / destPort
├── status: 'inactive' | 'connecting' | 'active' | 'error'
└── autoStart: boolean

SftpConnection
├── hostId → Host
├── currentPath: string
└── status: 'connecting' | 'connected' | 'disconnected' | 'error'

TransferTask
├── sourceConnectionId → SftpConnection
├── targetConnectionId → SftpConnection
├── status: 'pending' | 'transferring' | 'completed' | 'failed' | 'cancelled'
└── progress: { bytes, totalBytes, files, totalFiles }

ConnectionLog
├── sessionId → TerminalSession
├── hostId → Host
├── protocol / hostname / username
├── startTime / endTime
├── terminalData (可选，终端输出快照)
└── saved: boolean

GroupConfig (组默认配置，可被子主机继承)
├── groupPath: string
├── username / port / authMethod
├── proxyConfig / hostChain / envVars
└── theme / fontFamily / fontSize

ManagedSource (外部主机源，如 ~/.ssh/config)
├── type: 'ssh-config'
├── filePath: string
└── hostIds: string[] (导入的主机 ID)
```

## AI 相关模型

```
ProviderConfig
├── id / name / type (openai/anthropic/google/ollama/openrouter/custom)
├── apiKey / baseUrl
├── models: ModelInfo[]
└── advancedParams: { temperature, topP, maxTokens, ... }

AISession
├── id / title
├── scope: AISessionScope { type, targetId, hostIds }
├── messages: ChatMessage[]
├── externalSessionId (ACP 代理会话)
└── agentId (关联的代理)

ExternalAgentConfig
├── id / name / command / acpCommand
├── enabled: boolean
└── autoApprove: boolean
```

## 云同步模型

```
SyncConfig
├── provider: 'github' | 'google' | 'onedrive' | 'webdav' | 's3'
├── connection: ProviderConnection (OAuth tokens / credentials)
├── masterKey: MasterKeyConfig (加密主密钥)
├── autoSync: boolean
└── lastSync: number

SyncPayload (同步负载)
├── hosts / keys / identities / snippets
├── customGroups / snippetPackages
├── portForwardingRules / knownHosts / groupConfigs
├── settings (主题/字体/快捷键等)
└── meta: { version, deviceId, timestamp }
```

## 存储键速查

所有键定义在 `infrastructure/config/storageKeys.ts`，格式为 `netcatty_{feature}_{name}_v1`。

主要分类:
- Vault: `STORAGE_KEY_HOSTS`, `STORAGE_KEY_KEYS`, `STORAGE_KEY_IDENTITIES`, `STORAGE_KEY_SNIPPETS`, `STORAGE_KEY_GROUPS`
- 设置: `STORAGE_KEY_THEME`, `STORAGE_KEY_TERM_*`, `STORAGE_KEY_HOTKEY_*`, `STORAGE_KEY_UI_*`
- SFTP: `STORAGE_KEY_SFTP_*`
- 端口转发: `STORAGE_KEY_PORT_FORWARDING`, `STORAGE_KEY_PF_*`
- AI: `STORAGE_KEY_AI_*`
- 同步: `STORAGE_KEY_SYNC`
- 更新: `STORAGE_KEY_UPDATE_*`
