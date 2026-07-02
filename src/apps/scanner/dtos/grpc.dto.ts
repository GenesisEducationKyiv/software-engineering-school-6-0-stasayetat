import { IsString, IsUUID } from 'class-validator';

export class TrackRepoDto {
  @IsUUID()
  id!: string;

  @IsString()
  repo!: string;

  @IsString()
  lastSeenTag!: string;
}

export class UntrackRepoDto {
  @IsUUID()
  id!: string;
}
