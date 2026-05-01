import { env } from '@shared/env';
import { Repository } from '@shared/types/repository.types';

export const EMAIL_SUBJECT_CONFIRMATION = 'Confirm your subscription';

export const EMAIL_SUBJECT_RELEASE_NOTIFICATION = (repo: string, tag: string) => `New release for ${repo} - ${tag}`;

export const confirmationEmailTemplate = (token: string, repo: string) => `
  <!DOCTYPE html>
  <html>
    <body>
        <h2>Confirm your subscription</h2>
        <p>
          You've requested to receive GitHub release notifications for <strong>${repo}</strong>
        </p>
        <a href="${env.APP_URL}/api/confirm/${token}"
           style="background: #42acff; color: #fff; text-decoration: none;
                  padding: 10px 20px; border-radius: 6px">
          Confirm subscription
        </a>
        <hr style="border: none; border-top: 1px solid #e1e4e8; margin: 24px 0;" />
        <a href="${env.APP_URL}/api/unsubscribe/${token}"
           style="color: #8c959f; font-size: 12px;">
          Unsubscribe
        </a>
    </body>
  </html>
`;

export const releaseNotificationTemplate = (repo: Repository, tag: string, unsubscribeToken: string) => `
  <!DOCTYPE html>
  <html>
    <body>
      <div>
        <h2 style="margin: 0 0 8px; color: #24292f;">New release published</h2>
        <p style="color: #57606a; margin: 0 0 4px;">Repository</p>
        <p style="margin: 0 0 16px; font-weight: 600; color: #24292f;">${repo.repo}</p>
        <p style="color: #57606a; margin: 0 0 4px;">Version</p>
        <p style="margin: 0 0 24px;">
          <span style="background: #fff8c5; color: #9a6700; padding: 2px 10px; border-radius: 4px; font-family: monospace;">
            ${repo.last_seen_tag}
          </span>
          <span style="color: #57606a; margin: 0 6px;">→</span>
          <span style="background: #dafbe1; color: #1a7f37; padding: 2px 10px; border-radius: 4px; font-family: monospace;">
            ${tag}
          </span>
        </p>
        <a href="https://github.com/${repo.repo}/releases/tag/${tag}"
           style="display: inline-block; background: #24292f; color: #fff; text-decoration: none;
                  padding: 10px 20px; border-radius: 6px">
          View release on GitHub
        </a>
        <hr style="border: none; border-top: 1px solid #e1e4e8; margin: 24px 0;" />
        <a href="${env.APP_URL}/api/unsubscribe/${unsubscribeToken}"
           style="color: #8c959f; font-size: 12px;">
          Unsubscribe
        </a>
      </div>
    </body>
  </html>
`;
