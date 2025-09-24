// file : Program.cs
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi.Models;
using API_ATF_MOBILE.Data; // <— ajustez si votre namespace est différent

var builder = WebApplication.CreateBuilder(args);

// 1) Charger la chaîne de connexion depuis appsettings.json
//    Dans appsettings.json, ajoutez sous "ConnectionStrings" :
//    "DefaultConnection": "Server=.;Database=VotreBase;User Id=sa;Password=VotreMdp;"
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException("La chaîne de connexion 'DefaultConnection' est introuvable dans appsettings.json");
}


// 2) Enregistrer le DbContext EF Core avec SQL Server
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(connectionString)
);

// 3) Déclarations des services métier
builder.Services.AddControllers();

// CORS – autorise tout (pour DEV / tests mobiles uniquement !)
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy
            .AllowAnyOrigin()
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

// 4) Swagger / OpenAPI
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

// 5) (Optionnel) Forcer Kestrel à écouter sur 0.0.0.0:8088
builder.WebHost
       .UseKestrel()
       .UseUrls("http://0.0.0.0:8088");

var app = builder.Build();

// — Pipeline HTTP —

// a) CORS (doit venir avant UseRouting si vous utilisez [EnableCors])
app.UseCors();

// b) (Optionnel) HTTPS redirection si configuré
// app.UseHttpsRedirection();

// c) Auth (le cas échéant, pour [Authorize])
app.UseAuthorization();

// d) Swagger UI
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "API_ATF_MOBILE v1");
    c.RoutePrefix = "swagger";
});

// e) Fichiers statiques (wwwroot)
app.UseDefaultFiles();
app.UseStaticFiles();

// f) Enregistrement des routes vers les contrôleurs
app.MapControllers();

// g) Démarrage de l’application
app.Run();
