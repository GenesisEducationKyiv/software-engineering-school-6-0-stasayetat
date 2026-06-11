import { IsString, IsUUID } from 'class-validator';

export class GetSubscribersQueryDto {
  @IsString()
  repoIds!: string;
}

export class UpdateTagParamDto {
  @IsUUID()
  id!: string;
}

export class UpdateTagBodyDto {
  @IsString()
  tag!: string;
}
