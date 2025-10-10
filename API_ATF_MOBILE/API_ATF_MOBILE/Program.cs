// file : Program.cs
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi.Models;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using API_ATF_MOBILE.Data;
using API_ATF_MOBILE.Services;
using API_ATF_MOBILE.Middleware;
using Diris.Providers.WebMI;
using Diris.Storage.SqlServer;
using Diris.Core.Interfaces;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

// Configure Serilog for DIRIS logging
// Logs stockés dans C:\API_ATF_MOBILE\DATA\logs (persistants entre redéploiements)
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .WriteTo.File(@"C:\API_ATF_MOBILE\DATA\logs\app-.log", rollingInterval: Serilog.RollingInterval.Day, retainedFileCountLimit: 30)
    .CreateLogger();

builder.Host.UseSerilog();

// 1) Connexion SQL
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
if (string.IsNullOrWhiteSpace(connectionString))
    throw new InvalidOperationException("La cha�ne de connexion 'DefaultConnection' est introuvable dans appsettings.json");

// 2) EF Core
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(connectionString));

// 3) Services
builder.Services.AddControllers();

// 3.1) Services d'administration
builder.Services.AddSingleton<ISystemMonitorService, SystemMonitorService>();
builder.Services.AddSingleton<IServerMonitorService, ServerMonitorService>();
builder.Services.AddScoped<IDatabaseHealthService, DatabaseHealthService>();
builder.Services.AddSingleton<IS7MonitorService, S7MonitorService>();
builder.Services.AddSingleton<ILogReaderService, LogReaderService>();
builder.Services.AddScoped<IAuthenticationService, AuthenticationService>();
builder.Services.AddSingleton<IPlcConnectionService, PlcConnectionService>();
builder.Services.AddScoped<ICommentsService, CommentsService>();
builder.Services.AddScoped<ICommentsServiceV2, CommentsServiceV2>();

// 3.2) DIRIS Services - WebMI Provider et Storage
builder.Services.AddWebMiProvider(builder.Configuration.GetValue<int>("WebMi:RequestTimeoutMs", 1500));
builder.Services.AddSqlServerStorage(builder.Configuration);

// 3.3) DIRIS Services - Acquisition et Métriques
builder.Services.Configure<DirisAcquisitionOptions>(builder.Configuration.GetSection(DirisAcquisitionOptions.SectionName));
builder.Services.AddSingleton<DirisAcquisitionControlService>();
builder.Services.AddHostedService<DirisAcquisitionService>();
builder.Services.AddHostedService<DirisSignalSchedulerService>(); // Nouveau service avec scheduling séparé
builder.Services.AddSingleton<ISystemMetricsCollector, DirisSystemMetricsCollector>();

// 3.4) DIRIS Services - Data Retention
builder.Services.Configure<DirisDataRetentionOptions>(builder.Configuration.GetSection("DataRetention"));
builder.Services.AddSingleton<DirisDataRetentionService>();
builder.Services.AddHostedService<DirisDataRetentionService>(provider => provider.GetRequiredService<DirisDataRetentionService>());

// 3.5) DIRIS Services - Database Size Monitor
builder.Services.AddHostedService<DirisDatabaseSizeMonitorService>();

// 3.6) DIRIS Services - Acquisition Watchdog
builder.Services.AddHostedService<DirisAcquisitionWatchdogService>();



// 3.2) Configuration JWT Authentication
var jwtSecret = builder.Configuration["Jwt:Secret"] ?? "VotreCleSecreteTresTresLongueEtComplexePourAPI_ATF_MOBILE_2024!";
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "API_ATF_MOBILE";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "API_ATF_MOBILE_Admin";

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
        ValidateIssuer = true,
        ValidIssuer = jwtIssuer,
        ValidateAudience = true,
        ValidAudience = jwtAudience,
        ValidateLifetime = true,
        ClockSkew = TimeSpan.Zero
    };
});

builder.Services.AddAuthorization();

// 4) CORS (DEV : tout autoriser)
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", p =>
        p.AllowAnyOrigin()
         .AllowAnyHeader()
         .AllowAnyMethod());
});

// 5) Swagger
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "API_ATF_MOBILE",
        Version = "v1",
        Description = "API de communication entre ATF_MOBILE et SQL_AI_ATF"
    });
});

// 6) Kestrel / URL
builder.WebHost
       .UseKestrel()
       .UseUrls("http://0.0.0.0:8088");

var app = builder.Build();

// --- Pipeline ---

// a) CORS (avant le reste)
app.UseCors("AllowAll");

// a.1) Middleware de sécurité (avant tout le reste)
app.UseMiddleware<SecurityMiddleware>();

// a.2) Middleware de logging des requêtes
app.UseMiddleware<RequestLoggingMiddleware>();

// b) Swagger
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "API_ATF_MOBILE v1");
    c.RoutePrefix = "swagger";
});

// c) Fichiers statiques
app.UseDefaultFiles();

// d) StaticFiles avec politique de cache fine
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = ctx =>
    {
        var headers = ctx.Context.Response.Headers;
        var contentType = ctx.Context.Response.ContentType ?? string.Empty;

        // No-cache strict pour JS / CSS / JSON
        if (contentType.Contains("javascript", StringComparison.OrdinalIgnoreCase) ||
            contentType.Contains("css", StringComparison.OrdinalIgnoreCase) ||
            contentType.Contains("json", StringComparison.OrdinalIgnoreCase))
        {
            headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0";
            headers["Pragma"] = "no-cache";
            headers["Expires"] = "0";
        }
        // Cache long (ex: images) : ici 7 jours
        else if (contentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
        {
            headers["Cache-Control"] = "public, max-age=604800"; // 7 jours
        }
        // Sinon : laisser le comportement par d�faut (pas d'�crasement)
    }
});

// e) AuthN/AuthZ
app.UseAuthentication();
app.UseAuthorization();

// f) Routes API
app.MapControllers();

// g) Run with Serilog cleanup
try
{
    Log.Information("Starting API_ATF_MOBILE with integrated DIRIS Server on port 8088");
    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Application terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}
