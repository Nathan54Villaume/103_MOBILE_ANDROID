using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

// ? Ouvre l'API sur toutes les interfaces réseau (Android, PC, tablette, etc.)
builder.WebHost.UseUrls("http://0.0.0.0:8088");

// ? Services API + CORS + Swagger
builder.Services.AddControllers();
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

// ? Autoriser tous les accès (test/dev mobile/web)
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();

// ? Middleware pour Swagger
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "API_ATF_MOBILE v1");
    c.RoutePrefix = "swagger"; // accessible via /swagger
});

// ? Middleware pour les fichiers statiques (HTML/JS/CSS dans wwwroot/)
app.UseDefaultFiles(); // sert index.html automatiquement
app.UseStaticFiles();  // permet de charger CSS / JS

// ? CORS + Auth + Routes API
app.UseCors();
app.UseAuthorization();
app.MapControllers();

// ? Lancer l'application
app.Run();
