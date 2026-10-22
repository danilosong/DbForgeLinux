import com.healthmarketscience.jackcess.ColumnBuilder;
import com.healthmarketscience.jackcess.DataType;
import com.healthmarketscience.jackcess.Database;
import com.healthmarketscience.jackcess.DatabaseBuilder;
import com.healthmarketscience.jackcess.Table;
import com.healthmarketscience.jackcess.TableBuilder;
import java.math.BigDecimal;
import java.nio.file.Path;
import java.time.LocalDateTime;

public final class GenerateAccessFixture {
  private GenerateAccessFixture() {}

  public static void main(String[] args) throws Exception {
    if (args.length != 1) throw new IllegalArgumentException("Usage: GenerateAccessFixture <output.mdb>");
    Path output = Path.of(args[0]).toAbsolutePath();
    try (Database database = DatabaseBuilder.create(Database.FileFormat.V2000, output.toFile())) {
      TableBuilder customersBuilder = new TableBuilder("Customers")
          .addColumn(new ColumnBuilder("CustomerID", DataType.LONG))
          .addColumn(new ColumnBuilder("DisplayName", DataType.TEXT).setLength(100))
          .addColumn(new ColumnBuilder("CreditLimit", DataType.MONEY))
          .addColumn(new ColumnBuilder("CreatedAt", DataType.SHORT_DATE_TIME))
          .addColumn(new ColumnBuilder("IsActive", DataType.BOOLEAN))
          .addColumn(new ColumnBuilder("Notes", DataType.MEMO))
          .addColumn(new ColumnBuilder("OptionalCode", DataType.TEXT).setLength(30))
          .setPrimaryKey("CustomerID");
      Table customers = customersBuilder.toTable(database);
      customers.addRow(1, "João d'Ávila", new BigDecimal("1234.5600"), LocalDateTime.of(2024, 2, 29, 14, 35, 6), true,
          "Registro sintético para validar memo. " + "Conteúdo longo de teste; ".repeat(24), null);
      customers.addRow(2, "Marta São-Paulo", new BigDecimal("0.0100"), LocalDateTime.of(2025, 12, 1, 8, 5, 0), false,
          "Cliente de exemplo sem dados pessoais reais.", "A-02");
      customers.addRow(3, "NULL de demonstração", null, null, true, null, null);

      TableBuilder ordersBuilder = new TableBuilder("Orders")
          .addColumn(new ColumnBuilder("OrderID", DataType.LONG))
          .addColumn(new ColumnBuilder("CustomerID", DataType.LONG))
          .addColumn(new ColumnBuilder("OrderTotal", DataType.MONEY))
          .addColumn(new ColumnBuilder("OrderedAt", DataType.SHORT_DATE_TIME))
          .setPrimaryKey("OrderID");
      Table orders = ordersBuilder.toTable(database);
      orders.addRow(101, 1, new BigDecimal("42.7500"), LocalDateTime.of(2024, 3, 1, 9, 15, 0));
      orders.addRow(102, 2, new BigDecimal("19.9900"), LocalDateTime.of(2024, 3, 2, 17, 45, 30));

      TableBuilder tagsBuilder = new TableBuilder("Tags")
          .addColumn(new ColumnBuilder("TagID", DataType.LONG))
          .addColumn(new ColumnBuilder("TagName", DataType.TEXT).setLength(40))
          .setPrimaryKey("TagID");
      Table tags = tagsBuilder.toTable(database);
      tags.addRow(1, "café");
      tags.addRow(2, "revisão d'água");
    }
    System.out.println("Created synthetic Access fixture: " + output);
  }
}
