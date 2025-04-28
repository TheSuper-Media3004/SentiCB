from transformers import BertForSequenceClassification, BertTokenizerFast, Trainer, TrainingArguments
from datasets import load_dataset


def main():
    # 1. Load data from CSV files
    dataset = load_dataset(
        "csv",
        data_files={
            "train": "train.csv",
            "validation": "valid.csv"
        }
    )

    # 2. Initialize tokenizer
    tokenizer = BertTokenizerFast.from_pretrained("bert-base-uncased")

    # 3. Preprocessing function
    def preprocess(batch):
        # Tokenize the text column (assumes column name 'text')
        return tokenizer(
            batch["text"],
            truncation=True,
            padding="max_length",
            max_length=128
        )

    # Apply preprocessing
    dataset = dataset.map(preprocess, batched=True)

    # Rename label column (assumes column name 'label')
    dataset = dataset.rename_column("label", "labels")

    # Set format for PyTorch
    dataset.set_format(
        type="torch",
        columns=["input_ids", "attention_mask", "labels"]
    )

    # 4. Load the base model with a classification head (binary by default)
    num_labels = len(set(dataset["train"]["labels"]))
    model = BertForSequenceClassification.from_pretrained(
        "bert-base-uncased",
        num_labels=num_labels
    )

    # 5. Configure training arguments
    training_args = TrainingArguments(
        output_dir="fine_tuned_bert",
        overwrite_output_dir=True,
        num_train_epochs=3,
        per_device_train_batch_size=16,
        per_device_eval_batch_size=32,
        evaluation_strategy="epoch",
        save_strategy="epoch",
        logging_strategy="steps",
        logging_steps=100,
        learning_rate=2e-5,
        logging_dir="logs",
        load_best_model_at_end=True,
        metric_for_best_model="accuracy"
    )

    # 6. Define compute metrics (optional)
    import numpy as np
    from sklearn.metrics import accuracy_score, precision_recall_fscore_support

    def compute_metrics(pred):
        labels = pred.label_ids
        preds = np.argmax(pred.predictions, axis=1)
        precision, recall, f1, _ = precision_recall_fscore_support(labels, preds, average='binary')
        acc = accuracy_score(labels, preds)
        return {
            'accuracy': acc,
            'f1': f1,
            'precision': precision,
            'recall': recall
        }

    # 7. Initialize Trainer
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=dataset["train"],
        eval_dataset=dataset["validation"],
        tokenizer=tokenizer,
        compute_metrics=compute_metrics
    )

    # 8. Train the model
    trainer.train()

    # 9. Save the final model and tokenizer
    trainer.save_model("fine_tuned_bert")
    tokenizer.save_pretrained("fine_tuned_bert")


if __name__ == "__main__":
    main()
