import { useCallback } from "react";
import type { Host, Identity, SSHKey } from "../../../domain/models";
import { isEncryptedCredentialPlaceholder, sanitizeCredentialValue } from "../../../domain/credentials";
import { resolveHostAuth } from "../../../domain/sshAuth";

interface UseSftpHostCredentialsParams {
  hosts: Host[];
  keys: SSHKey[];
  identities: Identity[];
}

export const buildSftpHostCredentials = ({
  host,
  hosts,
  keys,
  identities,
}: UseSftpHostCredentialsParams & { host: Host }): NetcattySSHOptions => {
  if (host.proxyProfileId && !host.proxyConfig) {
    throw new Error(`Saved proxy for host "${host.label || host.hostname}" is missing. Open host settings and select a valid proxy.`);
  }

  const resolved = resolveHostAuth({ host, keys, identities });
  const key = resolved.key || null;

  const proxyConfig = host.proxyConfig
    ? {
      type: host.proxyConfig.type,
      host: host.proxyConfig.host,
      port: host.proxyConfig.port,
      username: host.proxyConfig.username,
      password: sanitizeCredentialValue(host.proxyConfig.password),
    }
    : undefined;
  let jumpHosts: NetcattyJumpHost[] | undefined;
  if (host.hostChain?.hostIds && host.hostChain.hostIds.length > 0) {
    jumpHosts = host.hostChain.hostIds.map((hostId) => {
      const jumpHost = hosts.find((candidate) => candidate.id === hostId);
      if (!jumpHost) {
        throw new Error(`Jump host "${hostId}" is missing. Open host settings and repair the jump host chain.`);
      }
      if (jumpHost.proxyProfileId && !jumpHost.proxyConfig) {
        throw new Error(`Saved proxy for jump host "${jumpHost.label || jumpHost.hostname}" is missing. Open host settings and select a valid proxy.`);
      }
      return jumpHost;
    }).map((jumpHost, index) => {
      const jumpAuth = resolveHostAuth({
        host: jumpHost,
        keys,
        identities,
      });
      const jumpKey = jumpAuth.key;
      const hasConfiguredJumpProxyEndpoint =
        index === 0 &&
        !!(jumpHost.proxyConfig?.host && jumpHost.proxyConfig?.port);
      if (
        hasConfiguredJumpProxyEndpoint &&
        jumpHost.proxyConfig?.username &&
        isEncryptedCredentialPlaceholder(jumpHost.proxyConfig.password) &&
        !sanitizeCredentialValue(jumpHost.proxyConfig.password)
      ) {
        throw new Error(`Proxy credentials for jump host "${jumpHost.label || jumpHost.hostname}" cannot be decrypted on this device. Open host settings and re-enter the proxy password.`);
      }
      return {
        hostname: jumpHost.hostname,
        port: jumpHost.port || 22,
        username: jumpAuth.username || "root",
        password: jumpAuth.password,
        privateKey: jumpKey?.privateKey,
        certificate: jumpKey?.certificate,
        passphrase: jumpAuth.passphrase || jumpKey?.passphrase,
        publicKey: jumpKey?.publicKey,
        keyId: jumpAuth.keyId,
        keySource: jumpKey?.source,
        label: jumpHost.label,
        proxy: jumpHost.proxyConfig?.host && jumpHost.proxyConfig?.port
          ? {
            type: jumpHost.proxyConfig.type,
            host: jumpHost.proxyConfig.host,
            port: jumpHost.proxyConfig.port,
            username: jumpHost.proxyConfig.username,
            password: sanitizeCredentialValue(jumpHost.proxyConfig.password),
          }
          : undefined,
        identityFilePaths: jumpHost.identityFilePaths,
      };
    });
  }
  const usesTargetProxyForFirstHop = !!proxyConfig && !jumpHosts?.[0]?.proxy;
  if (usesTargetProxyForFirstHop && host.proxyConfig?.username && isEncryptedCredentialPlaceholder(host.proxyConfig.password) && !proxyConfig?.password) {
    throw new Error("Proxy credentials cannot be decrypted on this device. Open host settings and re-enter the proxy password.");
  }

  return {
    hostname: host.hostname,
    username: resolved.username,
    port: host.port || 22,
    password: resolved.password,
    privateKey: key?.privateKey,
    certificate: key?.certificate,
    passphrase: resolved.passphrase || key?.passphrase,
    publicKey: key?.publicKey,
    keyId: resolved.keyId,
    keySource: key?.source,
    proxy: proxyConfig,
    jumpHosts: jumpHosts && jumpHosts.length > 0 ? jumpHosts : undefined,
    sudo: host.sftpSudo,
    identityFilePaths: host.identityFilePaths,
  };
};

export const useSftpHostCredentials = ({
  hosts,
  keys,
  identities,
}: UseSftpHostCredentialsParams) =>
  useCallback(
    (host: Host): NetcattySSHOptions => buildSftpHostCredentials({ host, hosts, keys, identities }),
    [hosts, identities, keys],
  );
