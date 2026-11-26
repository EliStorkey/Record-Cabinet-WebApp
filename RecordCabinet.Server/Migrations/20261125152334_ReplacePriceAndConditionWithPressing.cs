using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RecordCabinet.Server.Migrations
{
    /// <inheritdoc />
    public partial class ReplacePriceAndConditionWithPressing : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MediaCondition",
                table: "Records");

            migrationBuilder.DropColumn(
                name: "PurchasePrice",
                table: "Records");

            migrationBuilder.AddColumn<string>(
                name: "Pressing",
                table: "Records",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Pressing",
                table: "Records");

            migrationBuilder.AddColumn<string>(
                name: "MediaCondition",
                table: "Records",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "PurchasePrice",
                table: "Records",
                type: "decimal(10,2)",
                precision: 10,
                scale: 2,
                nullable: true);
        }
    }
}
