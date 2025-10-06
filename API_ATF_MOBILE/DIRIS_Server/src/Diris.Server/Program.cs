using Diris.Providers.WebMI;
using Diris.Server.Health;
using Diris.Server.Services;
using Diris.Storage.SqlServer;
using Diris.Core.Interfaces;
using Diris.Server;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

// Configure URLs from appsettings.json
var urls = builder.Configuration["Urls"] ?? "http://localhost:8087";
builder.WebHost.UseUrls(urls);

// Configure Serilog
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .WriteTo.File("logs/diris-.log", rollingInterval: RollingInterval.Day, retainedFileCountLimit: 30)
    .CreateLogger();

builder.Host.UseSerilog();

// Add services
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Add DIRIS services
builder.Services.AddDirisHealthChecks();
builder.Services.AddWebMiProvider(builder.Configuration.GetValue<int>("WebMi:RequestTimeoutMs", 1500));
builder.Services.AddSqlServerStorage(builder.Configuration);

// Add background services
builder.Services.Configure<AcquisitionOptions>(builder.Configuration.GetSection(AcquisitionOptions.SectionName));
builder.Services.AddHostedService<AcquisitionService>();
builder.Services.AddSingleton<ISystemMetricsCollector, SystemMetricsCollector>();

// Add data retention service
builder.Services.AddSingleton<DataRetentionService>();
builder.Services.AddHostedService<DataRetentionService>(provider => provider.GetRequiredService<DataRetentionService>());

// Add CORS
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

// No authentication required - all endpoints are public

// Configure Windows Service
builder.Services.AddWindowsService(options =>
{
    options.ServiceName = "DIRIS-Server";
});

var app = builder.Build();

// Configure pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors();
app.UseRouting();
app.UseStaticFiles();

// Map health checks
app.MapDirisHealthChecks();

// Map API controllers (no global authentication)
app.MapControllers();

// Map specific routes for static files
app.MapGet("/health", () => Results.Redirect("/health.html"));

// Map static files for UI
app.MapFallbackToFile("index.html");

// Start the application
try
{
    Log.Information("Starting DIRIS Server");
    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "DIRIS Server terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}
