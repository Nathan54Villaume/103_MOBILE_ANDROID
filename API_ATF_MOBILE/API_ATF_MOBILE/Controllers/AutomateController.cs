using Microsoft.AspNetCore.Mvc;
using API_ATF_MOBILE.Services;

namespace API_ATF_MOBILE.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AutomateController : ControllerBase
    {
        private readonly S7CommunicationService _s7;

        public AutomateController()
        {
            _s7 = new S7CommunicationService();
        }

        // ----------------------- Lecture générique -----------------------

        [HttpGet("read")]
        public IActionResult Read([FromQuery] string address)
        {
            try
            {
                _s7.Connect();
                var value = _s7.ReadRaw(address);
                _s7.Disconnect();
                return Ok(value);
            }
            catch (Exception ex)
            {
                return BadRequest($"Erreur lecture automate : {ex.Message}");
            }
        }

        // ----------------------- Lecture typée -----------------------

        [HttpGet("read/float")]
        public IActionResult ReadFloat([FromQuery] string address)
        {
            try
            {
                _s7.Connect();
                var value = _s7.ReadFloat(address);
                _s7.Disconnect();
                return Ok(value);
            }
            catch (Exception ex)
            {
                return BadRequest($"Erreur lecture float : {ex.Message}");
            }
        }

        [HttpGet("read/int16")]
        public IActionResult ReadInt16([FromQuery] string address)
        {
            try
            {
                _s7.Connect();
                var value = _s7.ReadInt16(address);
                _s7.Disconnect();
                return Ok(value);
            }
            catch (Exception ex)
            {
                return BadRequest($"Erreur lecture int16 : {ex.Message}");
            }
        }

        [HttpGet("read/int32")]
        public IActionResult ReadInt32([FromQuery] string address)
        {
            try
            {
                _s7.Connect();
                var value = _s7.ReadInt32(address);
                _s7.Disconnect();
                return Ok(value);
            }
            catch (Exception ex)
            {
                return BadRequest($"Erreur lecture int32 : {ex.Message}");
            }
        }

        [HttpGet("read/bool")]
        public IActionResult ReadBool([FromQuery] string address)
        {
            try
            {
                _s7.Connect();
                var value = _s7.ReadBool(address);
                _s7.Disconnect();
                return Ok(value);
            }
            catch (Exception ex)
            {
                return BadRequest($"Erreur lecture bool : {ex.Message}");
            }
        }

        [HttpGet("read/byte")]
        public IActionResult ReadByte([FromQuery] string address)
        {
            try
            {
                _s7.Connect();
                var value = _s7.ReadByte(address);
                _s7.Disconnect();
                return Ok(value);
            }
            catch (Exception ex)
            {
                return BadRequest($"Erreur lecture byte : {ex.Message}");
            }
        }

        // ----------------------- Lecture multiple (optimisée) -----------------------

        [HttpPost("read-multiple")]
        public IActionResult ReadMultiple([FromBody] List<string> addresses)
        {
            var results = new Dictionary<string, object>();

            try
            {
                _s7.Connect();

                foreach (var address in addresses)
                {
                    try
                    {
                        results[address] = _s7.ReadRaw(address);
                    }
                    catch (Exception e)
                    {
                        results[address] = $"Erreur: {e.Message}";
                    }
                }

                _s7.Disconnect();
                return Ok(results);
            }
            catch (Exception ex)
            {
                return BadRequest($"Erreur globale : {ex.Message}");
            }
        }
    }
}
