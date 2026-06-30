import { IsString, IsUUID, Matches } from 'class-validator';

export class TrackRepoDto {
  @IsUUID()
  id!: string;

  @IsString()
  @Matches(/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/, {
    message: 'repository name must be in format owner/repo',
  })
  repo!: string;

  @IsString()
  lastSeenTag!: string;
}
