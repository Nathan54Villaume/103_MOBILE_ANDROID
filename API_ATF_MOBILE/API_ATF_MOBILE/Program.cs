// file : Program.cs
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi.Models;
using API_ATF_MOBILE.Data;

var builder = WebApplication.CreateBuilder(args);

// 1) Connexion SQL
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
if (string.IsNullOrWhiteSpace(connectionString))
    throw new InvalidOperationException("La chaîne de connexion 'DefaultConnection' est introuvable dans appsettings.json");

// 2) EF Core
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(connectionString));

// 3) Services
builder.Services.AddControllers();

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
        // Sinon : laisser le comportement par défaut (pas d'écrasement)
    }
});

// e) AuthN/AuthZ (si besoin)
app.UseAuthorization();

// f) Routes API
app.MapControllers();

// g) Run
app.Run();
