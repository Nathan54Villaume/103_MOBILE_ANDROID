using Microsoft.AspNetCore.Mvc;

namespace API_ATF_MOBILE.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PingController : ControllerBase
    {
        [HttpGet]
        public IActionResult Get()
        {
            return Ok("API OK");
        }
    }
}
