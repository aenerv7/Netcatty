import { useCallback } from "react";
import type { Host, Identity, SSHKey } from "../../../domain/models";
import { resolveHostAuth } from "../../../domain/sshAuth";

interface UseSftpHostCredentialsParams {
  hosts: Host[];
  keys: SSHKey[];
  identities: Identity[];
}

export const useSftpHostCredentials = ({
  hosts,
  keys,
  identities,
}: UseSftpHostCredentialsParams) =>
  useCallback(
    (host: Host): NetcattySSHOptions => {
      const resolved = resolveHostAuth({ host, keys, identities });
      const key = resolved.key || null;

      const proxyConfig = host.proxyConfig
        ? {
          type: host.proxyConfig.type,
          host: host.proxyConfig.host,
          port: host.proxyConfig.port,
          username: host.proxyConfig.username,
          password: host.proxyConfig.password,
        }
        : undefined;

      let jumpHosts: NetcattyJumpHost[] | undefined;
      if (host.hostChain?.hostIds && host.hostChain.hostIds.length > 0) {
        jumpHosts = host.hostChain.hostIds
          .map((hostId) => hosts.find((h) => h.id === hostId))
          .filter((h): h is Host => !!h)
          .map((jumpHost) => {
            const jumpAuth = resolveHostAuth({
              host: jumpHost,
              keys,
              identities,
            });
            const jumpKey = jumpAuth.key;
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
            };
          });
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
    },
    [hosts, identities, keys],
  );
