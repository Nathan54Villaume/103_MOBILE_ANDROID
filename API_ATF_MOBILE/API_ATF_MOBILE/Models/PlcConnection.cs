namespace API_ATF_MOBILE.Models
{
    public class PlcConnection
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string Name { get; set; } = string.Empty;
        public string IpAddress { get; set; } = string.Empty;
        public int Rack { get; set; } = 0;
        public int Slot { get; set; } = 1;
        public int Port { get; set; } = 102;
        public string CpuType { get; set; } = "S7-1500";
        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime? LastModified { get; set; }
    }

    public class PlcConnectionStatus
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string IpAddress { get; set; } = string.Empty;
        public int Rack { get; set; }
        public int Slot { get; set; }
        public int Port { get; set; }
        public string CpuType { get; set; } = string.Empty;
        public string Status { get; set; } = "Déconnecté";
        public DateTime CreatedAt { get; set; }
    }

    public class PlcConnectionCreateDto
    {
        public string Name { get; set; } = string.Empty;
        public string IpAddress { get; set; } = string.Empty;
        public int Rack { get; set; } = 0;
        public int Slot { get; set; } = 1;
        public int Port { get; set; } = 102;
        public string CpuType { get; set; } = "S7-1500";
    }
}

