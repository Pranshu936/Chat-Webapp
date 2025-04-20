import redis
redis_client = redis.from_url("redis://localhost:6379")  # Adjust if needed
redis_client.flushdb()
print("Redis DB cleared")