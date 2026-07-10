import { IsEmail, IsString, IsUUID, Matches } from 'class-validator';

export class SubscribeDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Matches(/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/, {
    message: 'repository name must be in format owner/repo',
  })
  repo!: string;
}

export class ConfirmDto {
  @IsString()
  @IsUUID()
  token!: string;
}

export class UnsubscribeDto {
  @IsString()
  @IsUUID()
  token!: string;
}

export class GetSubscriptionsDto {
  @IsEmail()
  email!: string;
}
