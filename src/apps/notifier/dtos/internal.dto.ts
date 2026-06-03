import { IsOptional, IsString, IsUUID } from 'class-validator';

export class GetSubscribersQueryDto {
  @IsOptional()
  @IsString()
  repoIds?: string;
}

export class UpdateTagParamDto {
  @IsUUID()
  id!: string;
}

export class UpdateTagBodyDto {
  @IsString()
  tag!: string;
}
