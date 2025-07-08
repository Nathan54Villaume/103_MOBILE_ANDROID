using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

// 1) Ouvre l'API sur toutes les interfaces réseau (Android, PC, tablette, etc.)
builder.WebHost.UseUrls("http://0.0.0.0:8088");

// 2) Déclaration des services
builder.Services.AddControllers();

// CORS – on autorise tout (uniquement pour DEV / test mobile)
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

// Swagger/OpenAPI
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

var app = builder.Build();

// 3) Pipeline HTTP

// (Optionnel) .UseHttpsRedirection(); si vous configurez un certificat

// **Route matching**
app.UseRouting();

// CORS
app.UseCors();

// Auth (aucun [Authorize] pour l’instant, mais l’ordre est important)
app.UseAuthorization();

// Swagger — accessible sur ‘/swagger’
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "API_ATF_MOBILE v1");
    c.RoutePrefix = "swagger";
});

// Fichiers statiques (wwwroot/index.html, CSS, JS…)
app.UseDefaultFiles();
app.UseStaticFiles();

// Mappe vos contrôleurs [ApiController]
app.MapControllers();

app.Run();
