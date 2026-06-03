import { IsNumber, IsString, Min } from 'class-validator';

export class CreateTimeOffRequestDto {
  @IsString()
  employeeId: string;

  @IsString()
  locationId: string;

  @IsNumber()
  @Min(0.001)
  days: number;
}
