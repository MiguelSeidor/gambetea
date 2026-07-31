import { IsInt, Min } from "class-validator";

export class BidDto {
  @IsInt()
  @Min(1)
  amount!: number;
}
