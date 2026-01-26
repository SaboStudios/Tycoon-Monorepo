import {
  Entity,
  PrimaryColumn,
  Column,
  Repository,
  BeforeInsert,
  BeforeUpdate,
} from "typeorm";

@Entity("properties")
export class Property {
  @PrimaryColumn({ type: "int" })
  id: number;

  @Column({ type: "varchar", length: 255 })
  type: string;

  @Column({ type: "varchar", length: 255 })
  name: string;

  @Column({ type: "int", default: 0 })
  group_id: number;

  @Column({ type: "varchar", length: 255 })
  position: string;

  @Column({ type: "int" })
  grid_row: number;

  @Column({ type: "int" })
  grid_col: number;

  @Column({ type: "int", default: 0 })
  price: number;

  // All rent tiers mapped
  @Column({ type: "int", default: 0 })
  rent_site_only: number;

  @Column({ type: "int", default: 0 })
  rent_one_house: number;

  @Column({ type: "int", default: 0 })
  rent_two_houses: number;

  @Column({ type: "int", default: 0 })
  rent_three_houses: number;

  @Column({ type: "int", default: 0 })
  rent_four_houses: number;

  @Column({ type: "int", default: 0 })
  rent_hotel: number;

  @Column({ type: "int", default: 0 })
  cost_of_house: number;

  // Mortgage flag with default false
  @Column({ type: "boolean", default: false })
  is_mortgaged: boolean;

  @Column({ type: "varchar", length: 10, default: "#FFFFFF" })
  color: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  icon: string;

  // Validation hooks for position and grid coordinates
  @BeforeInsert()
  @BeforeUpdate()
  validateCoordinates() {
    if (!this.position || this.position.trim() === "") {
      throw new Error("Position is required");
    }

    if (
      typeof this.grid_row !== "number" ||
      this.grid_row < 0 ||
      this.grid_row > 9
    ) {
      throw new Error("Grid row must be a number between 0 and 9");
    }

    if (
      typeof this.grid_col !== "number" ||
      this.grid_col < 0 ||
      this.grid_col > 9
    ) {
      throw new Error("Grid column must be a number between 0 and 9");
    }
  }
}
