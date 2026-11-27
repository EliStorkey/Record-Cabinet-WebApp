using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RecordCabinet.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddDiscogsOAuth : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DiscogsAccessToken",
                table: "AspNetUsers",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DiscogsAccessTokenSecret",
                table: "AspNetUsers",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DiscogsUserName",
                table: "AspNetUsers",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DiscogsAccessToken",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "DiscogsAccessTokenSecret",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "DiscogsUserName",
                table: "AspNetUsers");
        }
    }
}
