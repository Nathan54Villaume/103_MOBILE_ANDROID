using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

// ?? Ouvre l'API sur toutes les interfaces réseau (Android, tablette, etc.)
builder.WebHost.UseUrls("http://0.0.0.0:8088");

// ? Enregistrement des services
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

// ? CORS pour développement mobile
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

// ? Swagger pour documentation
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

// ?? Middleware HTTP / Swagger
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "API_ATF_MOBILE v1");
    c.RoutePrefix = "swagger";
});

app.UseCors();
app.UseAuthorization();

app.MapControllers(); // ? REST API uniquement

app.Run();
