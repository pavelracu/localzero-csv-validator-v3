import csv
import random
import uuid
from faker import Faker
from datetime import datetime, timedelta

# Initialize Faker
fake = Faker()
Faker.seed(42)  # For reproducibility

# Configuration
FILENAME = "large_dataset.csv"
ROW_COUNT = 1_000_000  # 1 Million Rows
ERROR_RATE = 0.05      # 5% of rows will have errors

# Column Headers (The 20 Enterprise Columns)
HEADERS = [
    "ID", "First Name", "Last Name", "Email (Work)", "Email (Personal)", 
    "Phone (US)", "Job Title", "Department", "Company Name", "City", 
    "State", "Zip Code", "Country", "IP Address", "Last Login", 
    "Subscription Tier", "MRR", "Account Status", "Notes", "Tags"
]

def generate_row():
    # 1. Base Data (Clean)
    row = {
        "ID": str(uuid.uuid4()),
        "First Name": fake.first_name(),
        "Last Name": fake.last_name(),
        "Email (Work)": fake.company_email(),
        "Email (Personal)": fake.free_email(),
        "Phone (US)": fake.phone_number(), # Usually formats as (xxx) xxx-xxxx or similar
        "Job Title": fake.job(),
        "Department": random.choice(["Sales", "Engineering", "Marketing", "HR", "Legal", "Support"]),
        "Company Name": fake.company(),
        "City": fake.city(),
        "State": fake.state_abbr(),
        "Zip Code": fake.zipcode(),
        "Country": "USA", # Keeping simple for US Phone validation logic
        "IP Address": fake.ipv4(),
        "Last Login": fake.date_time_between(start_date='-1y', end_date='now').isoformat(),
        "Subscription Tier": random.choice(["Bronze", "Silver", "Gold", "Enterprise"]),
        "MRR": round(random.uniform(10.0, 5000.0), 2),
        "Account Status": random.choice(["Active", "Churned", "Trial", "Delinquent"]),
        "Notes": fake.sentence(),
        "Tags": ";".join(fake.words(nb=random.randint(1, 3)))
    }

    # 2. Inject Errors (Dirty Data logic for "The Mechanic")
    if random.random() < ERROR_RATE:
        error_type = random.choice(["phone", "email", "date"])
        
        if error_type == "phone":
            # Remove separators to simulate "1234567890" (Missing Format)
            row["Phone (US)"] = "".join(filter(str.isdigit, row["Phone (US)"]))
        
        elif error_type == "email":
            # Remove @ symbol to break validation
            row["Email (Work)"] = row["Email (Work)"].replace("@", "_at_")
            
        elif error_type == "date":
            # Set a future date (Invalid for 'Last Login')
            future_date = datetime.now() + timedelta(days=365)
            row["Last Login"] = future_date.isoformat()

    return [row[col] for col in HEADERS]

def main():
    print(f"🚀 Generating {ROW_COUNT} rows into {FILENAME}...")
    print(f"⚠️  Injecting errors in approx {int(ERROR_RATE * 100)}% of rows...")
    
    with open(FILENAME, mode="w", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        writer.writerow(HEADERS)
        
        for i in range(ROW_COUNT):
            writer.writerow(generate_row())
            
            if (i + 1) % 100_000 == 0:
                print(f"   ... {i + 1} rows written")

    print("✅ Done! File generated.")

if __name__ == "__main__":
    main()